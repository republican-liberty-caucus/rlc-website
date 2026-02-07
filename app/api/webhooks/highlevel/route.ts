import { headers } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';

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

interface MemberIdRow {
  id: string;
}

export async function POST(req: Request) {
  // Verify webhook signature (if configured)
  const headersList = await headers();
  const signature = headersList.get('x-highlevel-signature');

  // In production, verify the signature
  // For now, just log it
  if (signature) {
    console.log('HighLevel webhook signature received');
  }

  const payload: HighLevelWebhookPayload = await req.json();
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
        console.log(`Unhandled HighLevel webhook type: ${payload.type}`);
    }
  } catch (error) {
    console.error('Error processing HighLevel webhook:', error);
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

    await supabase
      .from('rlc_members')
      .update(updatePayload as never)
      .eq('id', supabaseMemberId);

    console.log(`Updated member ${supabaseMemberId} from HighLevel`);
  } else {
    // Try to find by email
    const { data } = await supabase
      .from('rlc_members')
      .select('id')
      .eq('email', contact.email)
      .single();

    const member = data as MemberIdRow | null;

    if (member) {
      // Link existing member to HighLevel contact
      await supabase
        .from('rlc_members')
        .update({ highlevel_contact_id: contact.id } as never)
        .eq('id', member.id);

      console.log(`Linked member ${member.id} to HighLevel contact ${contact.id}`);
    }
  }

  // Log the sync
  await supabase.from('rlc_highlevel_sync_log').insert({
    entity_type: 'contact',
    entity_id: supabaseMemberId || contact.email,
    highlevel_id: contact.id,
    action: 'inbound_update',
    status: 'completed',
    request_payload: contact,
  } as never);
}

async function handleOpportunityCreated(
  supabase: ReturnType<typeof createServerClient>,
  opportunity: NonNullable<HighLevelWebhookPayload['opportunity']>
) {
  // Find member by HighLevel contact ID
  const { data } = await supabase
    .from('rlc_members')
    .select('id')
    .eq('highlevel_contact_id', opportunity.contactId)
    .single();

  const member = data as MemberIdRow | null;

  if (!member) {
    console.log(`No member found for HighLevel contact ${opportunity.contactId}`);
    return;
  }

  // Create contribution if the opportunity has a monetary value
  if (opportunity.monetaryValue > 0) {
    await supabase.from('rlc_contributions').insert({
      member_id: member.id,
      contribution_type: 'donation',
      amount: opportunity.monetaryValue,
      payment_status: opportunity.status === 'won' ? 'completed' : 'pending',
      metadata: {
        highlevel_opportunity_id: opportunity.id,
        source: 'highlevel',
      },
    } as never);

    console.log(`Created contribution from HighLevel opportunity ${opportunity.id}`);
  }
}
