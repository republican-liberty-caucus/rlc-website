import { headers } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

interface HighLevelWebhookPayload {
  type: string;
  locationId: string;
  contact?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    tags?: string[];
    customField?: Record<string, string>;
  };
  opportunity?: {
    id: string;
    contactId: string;
    status: string;
    monetaryValue: number;
  };
}

interface ContactIdRow {
  id: string;
}

/**
 * Verify shared secret from HighLevel workflow custom webhook header.
 * Uses timing-safe comparison to prevent timing attacks.
 */
function verifySharedSecret(provided: string, expected: string): boolean {
  try {
    return crypto.timingSafeEqual(
      Buffer.from(provided),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

/** Capitalize first letter of each word, handling hyphenated and multi-word names */
function titleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function POST(req: Request) {
  const headersList = await headers();
  const signature = headersList.get('x-highlevel-signature');
  const webhookSecret = process.env.HIGHLEVEL_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error('HighLevel webhook: HIGHLEVEL_WEBHOOK_SECRET not configured');
    return new Response('Unauthorized', { status: 401 });
  }

  if (!signature) {
    logger.error('HighLevel webhook: Missing x-highlevel-signature header');
    return new Response('Unauthorized', { status: 401 });
  }

  if (!verifySharedSecret(signature, webhookSecret)) {
    logger.error('HighLevel webhook: Invalid signature');
    return new Response('Unauthorized', { status: 401 });
  }

  const rawBody = await req.text();

  let payload: HighLevelWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    logger.error('HighLevel webhook: Invalid JSON payload');
    return new Response('Invalid JSON', { status: 400 });
  }

  const supabase = createServerClient();

  try {
    switch (payload.type) {
      case 'contact.created':
      case 'contact.updated':
        if (payload.contact) {
          await handleContactUpdate(supabase, payload.contact);
        }
        break;

      case 'opportunity.created':
        if (payload.opportunity) {
          await handleOpportunityCreated(supabase, payload.opportunity);
        }
        break;

      default:
        logger.info(`Unhandled HighLevel webhook type: ${payload.type}`);
    }
  } catch (error) {
    logger.error('Error processing HighLevel webhook:', error);
    return new Response('Webhook processing failed', { status: 500 });
  }

  return Response.json({ success: true });
}

async function handleContactUpdate(
  supabase: ReturnType<typeof createServerClient>,
  contact: NonNullable<HighLevelWebhookPayload['contact']>
) {
  // Check if we have a Supabase member ID in custom fields
  const supabaseMemberId = contact.customField?.['supabase_member_id'];

  if (supabaseMemberId) {
    // Update existing member
    const updatePayload = {
      highlevel_contact_id: contact.id,
      ...(contact.firstName && { first_name: titleCase(contact.firstName) }),
      ...(contact.lastName && { last_name: titleCase(contact.lastName) }),
      ...(contact.phone && { phone: contact.phone }),
    };

    const { error: updateError } = await supabase
      .from('rlc_contacts')
      .update(updatePayload as never)
      .eq('id', supabaseMemberId);

    if (updateError) {
      logger.error(`Failed to update member ${supabaseMemberId}:`, updateError);
      throw updateError;
    }

    logger.info(`Updated member ${supabaseMemberId} from HighLevel`);
  } else {
    // Try to find by email
    const { data, error: selectError } = await supabase
      .from('rlc_contacts')
      .select('id')
      .eq('email', contact.email)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is expected
      logger.error(`Failed to find member by email ${contact.email}:`, selectError);
    }

    const member = data as ContactIdRow | null;

    if (member) {
      // Link existing member to HighLevel contact
      const { error: linkError } = await supabase
        .from('rlc_contacts')
        .update({ highlevel_contact_id: contact.id } as never)
        .eq('id', member.id);

      if (linkError) {
        logger.error(`Failed to link member ${member.id} to HighLevel:`, linkError);
        throw linkError;
      }

      logger.info(`Linked member ${member.id} to HighLevel contact ${contact.id}`);
    }
  }

  // Log the sync
  const { error: logError } = await supabase.from('rlc_highlevel_sync_log').insert({
    entity_type: 'contact',
    entity_id: supabaseMemberId || contact.email,
    highlevel_id: contact.id,
    action: 'inbound_update',
    status: 'completed',
    request_payload: contact,
  } as never);

  if (logError) {
    logger.error('Failed to log sync:', logError);
    // Don't throw - logging failure shouldn't fail the webhook
  }
}

async function handleOpportunityCreated(
  supabase: ReturnType<typeof createServerClient>,
  opportunity: NonNullable<HighLevelWebhookPayload['opportunity']>
) {
  // Find member by HighLevel contact ID
  const { data, error: selectError } = await supabase
    .from('rlc_contacts')
    .select('id')
    .eq('highlevel_contact_id', opportunity.contactId)
    .single();

  if (selectError && selectError.code !== 'PGRST116') {
    logger.error(`Failed to find member for HighLevel contact ${opportunity.contactId}:`, selectError);
  }

  const member = data as ContactIdRow | null;

  if (!member) {
    logger.info(`No member found for HighLevel contact ${opportunity.contactId}`);
    return;
  }

  // Create contribution if the opportunity has a monetary value
  if (opportunity.monetaryValue > 0) {
    // Idempotency: check if we already created a contribution for this opportunity
    const { data: existing } = await supabase
      .from('rlc_contributions')
      .select('id')
      .contains('metadata', { highlevel_opportunity_id: opportunity.id })
      .limit(1)
      .maybeSingle();

    if (existing) {
      logger.info(`Contribution already exists for HighLevel opportunity ${opportunity.id}, skipping`);
      return;
    }

    const { error: insertError } = await supabase.from('rlc_contributions').insert({
      contact_id: member.id,
      contribution_type: 'donation',
      amount: opportunity.monetaryValue,
      payment_status: opportunity.status === 'won' ? 'completed' : 'pending',
      metadata: {
        highlevel_opportunity_id: opportunity.id,
        source: 'highlevel',
      },
    } as never);

    if (insertError) {
      logger.error(`Failed to create contribution from opportunity ${opportunity.id}:`, insertError);
      throw insertError;
    }

    logger.info(`Created contribution from HighLevel opportunity ${opportunity.id}`);
  }
}
