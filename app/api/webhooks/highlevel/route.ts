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
 * Verify HighLevel webhook signature using HMAC-SHA256
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const headersList = await headers();
  const signature = headersList.get('x-highlevel-signature');
  const webhookSecret = process.env.HIGHLEVEL_WEBHOOK_SECRET;

  // Get raw body for signature verification
  const rawBody = await req.text();

  // Verify webhook signature - require secret in production
  if (!webhookSecret) {
    logger.error('HighLevel webhook: HIGHLEVEL_WEBHOOK_SECRET not configured');
    return new Response('Webhook secret not configured', { status: 500 });
  }

  if (!signature) {
    logger.error('HighLevel webhook: Missing signature header');
    return new Response('Missing signature', { status: 401 });
  }

  if (!verifySignature(rawBody, signature, webhookSecret)) {
    logger.error('HighLevel webhook: Invalid signature');
    return new Response('Invalid signature', { status: 401 });
  }

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
      ...(contact.firstName && { first_name: contact.firstName }),
      ...(contact.lastName && { last_name: contact.lastName }),
      ...(contact.phone && { phone: contact.phone }),
    };

    const { error: updateError } = await supabase
      .from('rlc_members')
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
      .from('rlc_members')
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
        .from('rlc_members')
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
    .from('rlc_members')
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
