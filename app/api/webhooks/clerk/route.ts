import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { createServerClient, upsertMemberFromClerk } from '@/lib/supabase/server';
import { syncMemberToHighLevel } from '@/lib/highlevel/client';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('', { status: 400 });
  }

  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('Clerk webhook: CLERK_WEBHOOK_SECRET not configured');
    return new Response('', { status: 500 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  let evt: WebhookEvent;

  try {
    const wh = new Webhook(webhookSecret);
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    logger.error('Clerk webhook signature verification failed:', err);
    return new Response('', { status: 400 });
  }

  try {
    switch (evt.type) {
      case 'user.created':
      case 'user.updated': {
        await handleUserCreateOrUpdate(evt);
        break;
      }

      case 'user.deleted': {
        await handleUserDeleted(evt);
        break;
      }

      default:
        logger.info(`Unhandled Clerk event type: ${evt.type}`);
    }
  } catch (error) {
    logger.error(`Error processing Clerk webhook ${evt.type}:`, error);
    return new Response('', { status: 500 });
  }

  return new Response('', { status: 200 });
}

async function handleUserCreateOrUpdate(evt: WebhookEvent) {
  if (evt.type !== 'user.created' && evt.type !== 'user.updated') return;

  const { id, email_addresses, first_name, last_name, phone_numbers } = evt.data;

  const member = await upsertMemberFromClerk({
    id,
    email_addresses,
    first_name,
    last_name,
    phone_numbers,
  });

  // Sync to HighLevel (non-fatal)
  try {
    await syncMemberToHighLevel({
      id: member.id,
      email: member.email,
      firstName: member.first_name,
      lastName: member.last_name,
      phone: member.phone,
      addressLine1: member.address_line1,
      city: member.city,
      state: member.state,
      postalCode: member.postal_code,
      membershipTier: member.membership_tier,
      membershipStatus: member.membership_status,
      membershipStartDate: member.membership_start_date || undefined,
      membershipExpiryDate: member.membership_expiry_date || undefined,
      membershipJoinDate: member.membership_join_date || undefined,
    });
  } catch (hlError) {
    logger.error(`HighLevel sync failed for member ${member.id} (non-fatal):`, hlError);
  }

  logger.info(`Processed ${evt.type} for Clerk user ${id} → member ${member.id}`);
}

async function handleUserDeleted(evt: WebhookEvent) {
  if (evt.type !== 'user.deleted') return;

  const clerkUserId = evt.data.id;
  if (!clerkUserId) {
    throw new Error('Clerk user.deleted event missing user ID');
  }

  const supabase = createServerClient();

  // Find the member by clerk_user_id
  const { data, error } = await supabase
    .from('rlc_members')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      logger.info(`No member found for deleted Clerk user ${clerkUserId}, nothing to do`);
      return;
    }
    throw new Error(`Database error looking up deleted Clerk user ${clerkUserId}: ${error.message}`);
  }

  const member = data as { id: string; household_id: string | null; household_role: string | null };

  // Cancel the membership
  const updatePayload: Record<string, unknown> = {
    membership_status: 'cancelled',
    clerk_user_id: null,
  };

  // If this is a household primary member, clear household linkage for dependents
  if (member.household_role === 'primary' && member.household_id) {
    const { error: householdError } = await supabase
      .from('rlc_members')
      .update({
        membership_status: 'cancelled',
        household_id: null,
        household_role: null,
        primary_contact_id: null,
      } as never)
      .eq('primary_contact_id', member.id);

    if (householdError) {
      throw new Error(`Failed to update household members for deleted primary ${member.id}: ${householdError.message}`);
    }

    updatePayload.household_id = null;
    updatePayload.household_role = null;
  }

  const { error: updateError } = await supabase
    .from('rlc_members')
    .update(updatePayload as never)
    .eq('id', member.id);

  if (updateError) {
    logger.error(`Failed to cancel member ${member.id} after Clerk deletion:`, updateError);
    throw updateError;
  }

  logger.info(`Clerk user ${clerkUserId} deleted → member ${member.id} cancelled`);
}
