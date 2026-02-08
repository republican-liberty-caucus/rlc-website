import Stripe from 'stripe';
import { headers } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { getStripe, MEMBERSHIP_TIERS } from '@/lib/stripe/client';
import { syncMemberToHighLevel } from '@/lib/highlevel/client';
import { triggerWelcomeSequence } from '@/lib/highlevel/notifications';
import { processDuesSplit } from '@/lib/dues-sharing/split-engine';
import type { Member, MembershipTier, MembershipStatus } from '@/types';
import { logger } from '@/lib/logger';

const VALID_TIERS = new Set(MEMBERSHIP_TIERS.map((t) => t.tier));

function isValidTier(tier: string): tier is MembershipTier {
  return VALID_TIERS.has(tier as MembershipTier);
}

// Map Stripe subscription statuses to our membership statuses
const SUBSCRIPTION_STATUS_MAP: Record<string, MembershipStatus> = {
  active: 'current',
  trialing: 'new_member',
  past_due: 'grace',
  canceled: 'cancelled',
  unpaid: 'expired',
  incomplete: 'pending',
  incomplete_expired: 'expired',
};

// Helper to find a member by stripe_customer_id with proper error handling
async function findMemberByCustomerId(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
  context: string
): Promise<Member | null> {
  const { data, error } = await supabase
    .from('rlc_members')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Genuinely not found
      logger.error(`${context}: No member found for stripe_customer_id="${customerId}"`);
      return null;
    }
    // Real database error — throw so webhook returns 500 and Stripe retries
    logger.error(`${context}: Database error looking up customer "${customerId}":`, error);
    throw new Error(`Database error in ${context}: ${error.message}`);
  }

  return data as Member;
}

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    logger.error('Stripe webhook: Missing stripe-signature header');
    return new Response('', { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('Stripe webhook: STRIPE_WEBHOOK_SECRET not configured');
    return new Response('', { status: 500 });
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    // constructEvent verifies signature + rejects events older than 300s (replay protection)
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logger.error('Stripe webhook signature verification failed:', err);
    return new Response('', { status: 400 });
  }

  const supabase = createServerClient();

  // Event-level idempotency (issue #54): attempt insert into rlc_webhook_events.
  // If the table exists and has a unique constraint on stripe_event_id,
  // duplicate events are rejected. If the table doesn't exist yet, we
  // fall through gracefully — payment-intent-level dedup in handlers still protects
  // against duplicate contributions.
  try {
    const { error: idempotencyError } = await supabase
      .from('rlc_webhook_events')
      .insert({ stripe_event_id: event.id, event_type: event.type } as never);

    if (idempotencyError?.code === '23505') {
      logger.info(`Stripe event ${event.id} already processed, skipping`);
      return new Response('', { status: 200 });
    }
    // 42P01 = table doesn't exist — gracefully fall through
    if (idempotencyError && idempotencyError.code !== '42P01') {
      logger.error('Webhook idempotency check failed:', idempotencyError);
    }
  } catch {
    // Non-fatal — continue processing even if idempotency check fails
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(supabase, session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(supabase, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCancelled(supabase, subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(supabase, invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoiceFailed(supabase, invoice);
        break;
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(supabase, account);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(supabase, charge);
        break;
      }

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    logger.error('Error processing Stripe webhook:', error);
    return new Response('', { status: 500 });
  }

  return new Response('', { status: 200 });
}

async function handleCheckoutComplete(
  supabase: ReturnType<typeof createServerClient>,
  session: Stripe.Checkout.Session
) {
  const checkoutType = session.metadata?.type || 'membership';

  if (checkoutType === 'donation') {
    await handleDonationCheckout(supabase, session);
    return;
  }

  const customerId = session.customer as string;
  const memberEmail = session.customer_email;
  const tier = session.metadata?.tier;
  const memberId = session.metadata?.member_id;

  if (!memberEmail) {
    logger.error(`Checkout session ${session.id} has no customer_email`);
    throw new Error(`Checkout session ${session.id} missing customer_email`);
  }

  // Validate tier from metadata — do not silently fall back
  if (!tier || !isValidTier(tier)) {
    logger.error(
      `Checkout session ${session.id} has invalid/missing tier metadata: "${tier}". ` +
      `Customer: ${memberEmail}, Payment: ${session.payment_intent}`
    );
    throw new Error(`Invalid tier metadata "${tier}" for checkout session ${session.id}`);
  }
  const membershipTier = tier;

  // Find the member by ID (if provided) or email
  let member: Member | null = null;

  if (memberId) {
    const { data, error } = await supabase
      .from('rlc_members')
      .select('*')
      .eq('id', memberId)
      .single();
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database error looking up member_id="${memberId}": ${error.message}`);
    }
    member = data as Member | null;
  }

  if (!member) {
    const { data, error } = await supabase
      .from('rlc_members')
      .select('*')
      .eq('email', memberEmail)
      .single();
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database error looking up email="${memberEmail}": ${error.message}`);
    }
    member = data as Member | null;
  }

  if (!member) {
    logger.error(
      `Member not found for checkout session ${session.id}: email=${memberEmail}, member_id=${memberId}`
    );
    throw new Error(`Member not found for checkout session ${session.id}`);
  }

  // Idempotency: check if this payment was already processed
  const paymentIntentId = (session.payment_intent as string | null) || null;
  if (paymentIntentId) {
    const { data: existing } = await supabase
      .from('rlc_contributions')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single();

    if (existing) {
      logger.info(`Checkout already processed for payment_intent ${paymentIntentId}, skipping`);
      return;
    }
  }

  // Calculate membership dates: 1 year from now
  const now = new Date();
  const expiryDate = new Date(now);
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  // Update member with Stripe info, tier, and dates
  const { error: updateError } = await supabase
    .from('rlc_members')
    .update({
      stripe_customer_id: customerId,
      membership_tier: membershipTier,
      membership_status: 'new_member',
      membership_start_date: now.toISOString(),
      membership_expiry_date: expiryDate.toISOString(),
      membership_join_date: member.membership_join_date || now.toISOString(),
    } as never)
    .eq('id', member.id);

  if (updateError) {
    logger.error(`Failed to update member ${member.id}:`, updateError);
    throw updateError;
  }

  // Create contribution record — attribute to member's primary chapter for dues splitting
  const { data: contributionRow, error: insertError } = await supabase
    .from('rlc_contributions')
    .insert({
      member_id: member.id,
      contribution_type: 'membership',
      amount: (session.amount_total || 0) / 100,
      currency: session.currency?.toUpperCase() || 'USD',
      stripe_payment_intent_id: paymentIntentId,
      payment_status: 'completed',
      is_recurring: session.mode === 'subscription',
      chapter_id: member.primary_chapter_id || null,
    } as never)
    .select('id')
    .single();

  if (insertError) {
    logger.error(`Failed to create contribution for member ${member.id}:`, insertError);
    throw insertError;
  }

  // Process dues split (non-fatal — payment is already recorded)
  if (contributionRow) {
    try {
      await processDuesSplit((contributionRow as { id: string }).id);
    } catch (splitError) {
      logger.error(`Dues split failed for contribution ${(contributionRow as { id: string }).id} (non-fatal):`, splitError);
    }
  }

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
      membershipTier,
      membershipStatus: 'new_member',
      membershipStartDate: now.toISOString(),
      membershipExpiryDate: expiryDate.toISOString(),
      membershipJoinDate: member.membership_join_date || now.toISOString(),
    });

    // Trigger welcome email/SMS sequence via HighLevel workflow
    await triggerWelcomeSequence(member.email);
  } catch (hlError) {
    logger.error('HighLevel sync failed (non-fatal):', hlError);
  }

  logger.info(`Checkout completed for member ${member.id}: tier=${membershipTier}`);
}

async function handleSubscriptionChange(
  supabase: ReturnType<typeof createServerClient>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const member = await findMemberByCustomerId(supabase, customerId, 'handleSubscriptionChange');

  if (!member) {
    throw new Error(`Member not found for subscription ${subscription.id}, customer ${customerId}`);
  }

  const membershipStatus = SUBSCRIPTION_STATUS_MAP[subscription.status] || 'pending';

  const { error: updateError } = await supabase
    .from('rlc_members')
    .update({
      membership_status: membershipStatus,
      membership_start_date: new Date(subscription.current_period_start * 1000).toISOString(),
      membership_expiry_date: new Date(subscription.current_period_end * 1000).toISOString(),
    } as never)
    .eq('id', member.id);

  if (updateError) {
    logger.error(`Failed to update subscription for member ${member.id}:`, updateError);
    throw updateError;
  }

  logger.info(`Subscription updated for member ${member.id}: ${subscription.status} → ${membershipStatus}`);
}

async function handleSubscriptionCancelled(
  supabase: ReturnType<typeof createServerClient>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const member = await findMemberByCustomerId(supabase, customerId, 'handleSubscriptionCancelled');

  if (!member) {
    throw new Error(`Member not found for cancelled subscription ${subscription.id}, customer ${customerId}`);
  }

  const { error: updateError } = await supabase
    .from('rlc_members')
    .update({ membership_status: 'cancelled' } as never)
    .eq('id', member.id);

  if (updateError) {
    logger.error(`Failed to cancel subscription for member ${member.id}:`, updateError);
    throw updateError;
  }

  logger.info(`Subscription cancelled for member ${member.id}`);
}

async function handleInvoicePaid(
  supabase: ReturnType<typeof createServerClient>,
  invoice: Stripe.Invoice
) {
  const customerId = invoice.customer as string;
  const member = await findMemberByCustomerId(supabase, customerId, 'handleInvoicePaid');

  if (!member) {
    throw new Error(`Member not found for paid invoice ${invoice.id}, customer ${customerId}`);
  }

  // Idempotency check
  const paymentIntentId = (invoice.payment_intent as string | null) || null;
  if (paymentIntentId) {
    const { data: existing } = await supabase
      .from('rlc_contributions')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single();

    if (existing) {
      logger.info(`Invoice already processed for payment_intent ${paymentIntentId}, skipping`);
      return;
    }
  }

  // Attribute renewal to member's current chapter (at time of renewal)
  const { data: contributionRow, error: insertError } = await supabase
    .from('rlc_contributions')
    .insert({
      member_id: member.id,
      contribution_type: 'membership',
      amount: (invoice.amount_paid || 0) / 100,
      currency: invoice.currency?.toUpperCase() || 'USD',
      stripe_payment_intent_id: paymentIntentId,
      payment_status: 'completed',
      is_recurring: true,
      chapter_id: member.primary_chapter_id || null,
    } as never)
    .select('id')
    .single();

  if (insertError) {
    logger.error(`Failed to record contribution for member ${member.id}:`, insertError);
    throw insertError;
  }

  // Process dues split (non-fatal)
  if (contributionRow) {
    try {
      await processDuesSplit((contributionRow as { id: string }).id);
    } catch (splitError) {
      logger.error(`Dues split failed for renewal contribution ${(contributionRow as { id: string }).id} (non-fatal):`, splitError);
    }
  }

  logger.info(`Invoice paid for member ${member.id}`);
}

async function handleInvoiceFailed(
  supabase: ReturnType<typeof createServerClient>,
  invoice: Stripe.Invoice
) {
  const customerId = invoice.customer as string;
  const member = await findMemberByCustomerId(supabase, customerId, 'handleInvoiceFailed');

  if (!member) {
    throw new Error(`Member not found for failed invoice ${invoice.id}, customer ${customerId}`);
  }

  const { error: insertError } = await supabase.from('rlc_contributions').insert({
    member_id: member.id,
    contribution_type: 'membership',
    amount: (invoice.amount_due || 0) / 100,
    currency: invoice.currency?.toUpperCase() || 'USD',
    stripe_payment_intent_id: (invoice.payment_intent as string | null) || null,
    payment_status: 'failed',
    is_recurring: true,
  } as never);

  if (insertError) {
    logger.error(`Failed to record failed contribution for member ${member.id}:`, insertError);
    throw insertError;
  }

  logger.info(`Invoice failed for member ${member.id}`);
}

async function handleDonationCheckout(
  supabase: ReturnType<typeof createServerClient>,
  session: Stripe.Checkout.Session
) {
  const memberEmail = session.customer_email;
  const memberId = session.metadata?.member_id || null;
  const chapterId = session.metadata?.chapter_id || null;
  const campaignId = session.metadata?.campaign_id || null;
  const paymentIntentId = (session.payment_intent as string | null) || null;

  if (!memberEmail) {
    logger.error(`Donation checkout ${session.id} has no customer_email`);
    throw new Error(`Donation checkout ${session.id} missing customer_email`);
  }

  // Idempotency check
  if (paymentIntentId) {
    const { data: existing } = await supabase
      .from('rlc_contributions')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single();

    if (existing) {
      logger.info(`Donation already processed for payment_intent ${paymentIntentId}, skipping`);
      return;
    }
  }

  // Resolve member_id if provided
  let resolvedMemberId: string | null = null;
  if (memberId) {
    const { data, error: lookupErr } = await supabase
      .from('rlc_members')
      .select('id')
      .eq('id', memberId)
      .single();

    if (lookupErr && lookupErr.code !== 'PGRST116') {
      logger.error(`Donation checkout: Database error looking up member_id="${memberId}":`, lookupErr);
      throw new Error(`Database error looking up member for donation: ${lookupErr.message}`);
    }

    if (data) {
      resolvedMemberId = (data as { id: string }).id;
    } else {
      logger.warn(`Donation checkout ${session.id}: member_id="${memberId}" from metadata not found in database`);
    }
  }

  const { error: insertError } = await supabase.from('rlc_contributions').insert({
    member_id: resolvedMemberId,
    contribution_type: 'donation',
    amount: (session.amount_total || 0) / 100,
    currency: session.currency?.toUpperCase() || 'USD',
    stripe_payment_intent_id: paymentIntentId,
    payment_status: 'completed',
    chapter_id: chapterId || null,
    campaign_id: campaignId || null,
    is_recurring: session.mode === 'subscription',
    source: 'website',
    metadata: { donor_email: memberEmail },
  } as never);

  if (insertError) {
    logger.error(`Failed to record donation:`, insertError);
    throw insertError;
  }

  logger.info(`Donation completed: $${(session.amount_total || 0) / 100} from ${memberEmail}`);
}

// ===========================================
// Stripe Connect: account.updated
// ===========================================

async function handleAccountUpdated(
  supabase: ReturnType<typeof createServerClient>,
  account: Stripe.Account
) {
  const stripeAccountId = account.id;

  // Find the chapter stripe account
  const { data: chapterAccount, error: lookupError } = await supabase
    .from('rlc_chapter_stripe_accounts')
    .select('id, chapter_id, status')
    .eq('stripe_account_id', stripeAccountId)
    .single();

  if (lookupError || !chapterAccount) {
    // Not one of our connected accounts — ignore
    logger.info(`account.updated for unknown account ${stripeAccountId}, ignoring`);
    return;
  }

  const row = chapterAccount as { id: string; chapter_id: string; status: string };
  const chargesEnabled = account.charges_enabled ?? false;
  const payoutsEnabled = account.payouts_enabled ?? false;

  // Determine new status
  let newStatus: string = row.status;
  if (chargesEnabled && payoutsEnabled) {
    newStatus = 'active';
  } else if (account.details_submitted) {
    newStatus = 'onboarding'; // Submitted but not yet verified
  }

  const updatePayload: Record<string, unknown> = {
    charges_enabled: chargesEnabled,
    payouts_enabled: payoutsEnabled,
    status: newStatus,
  };

  // Mark onboarding completed if newly active
  if (newStatus === 'active' && row.status !== 'active') {
    updatePayload.onboarding_completed_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from('rlc_chapter_stripe_accounts')
    .update(updatePayload as never)
    .eq('id', row.id);

  if (updateError) {
    logger.error(`Failed to update ChapterStripeAccount for ${stripeAccountId}:`, updateError);
    throw updateError;
  }

  // If newly active, drain pending ledger entries
  if (newStatus === 'active' && row.status !== 'active') {
    await drainPendingLedgerEntries(supabase, row.chapter_id, stripeAccountId);
  }

  logger.info(
    `account.updated: ${stripeAccountId} → status=${newStatus}, charges=${chargesEnabled}, payouts=${payoutsEnabled}`
  );
}

/** Transfer all pending ledger entries for a chapter that just became active */
async function drainPendingLedgerEntries(
  supabase: ReturnType<typeof createServerClient>,
  chapterId: string,
  stripeAccountId: string
) {
  // Import transfer function lazily to avoid circular deps
  const { executeTransfer } = await import('@/lib/dues-sharing/transfer-engine');

  const { data: pendingEntries, error } = await supabase
    .from('rlc_split_ledger_entries')
    .select('id, amount, stripe_transfer_group_id')
    .eq('recipient_chapter_id', chapterId)
    .eq('status', 'pending');

  if (error || !pendingEntries || pendingEntries.length === 0) return;

  logger.info(`Draining ${pendingEntries.length} pending ledger entries for chapter ${chapterId}`);

  for (const entry of pendingEntries) {
    const row = entry as { id: string; amount: number; stripe_transfer_group_id: string | null };
    try {
      await executeTransfer({
        ledgerEntryId: row.id,
        amountCents: Math.round(Number(row.amount) * 100),
        destinationAccountId: stripeAccountId,
        transferGroup: row.stripe_transfer_group_id || undefined,
      });
    } catch (transferError) {
      logger.error(`Failed to drain ledger entry ${row.id} (non-fatal):`, transferError);
    }
  }
}

// ===========================================
// Refund handling: charge.refunded
// ===========================================

async function handleChargeRefunded(
  supabase: ReturnType<typeof createServerClient>,
  charge: Stripe.Charge
) {
  const paymentIntentId = charge.payment_intent as string | null;
  if (!paymentIntentId) {
    logger.info('charge.refunded with no payment_intent, skipping');
    return;
  }

  // Find the contribution
  const { data: contribution, error: contribError } = await supabase
    .from('rlc_contributions')
    .select('id, amount')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single();

  if (contribError || !contribution) {
    logger.info(`charge.refunded: No contribution found for pi=${paymentIntentId}`);
    return;
  }

  const contribRow = contribution as { id: string; amount: number };
  const contributionAmountCents = Math.round(Number(contribRow.amount) * 100);

  // Determine if full or partial refund
  const refundedAmountCents = charge.amount_refunded;
  const isFullRefund = refundedAmountCents >= contributionAmountCents;

  // Get ledger entries for this contribution (excluding existing reversals)
  const { data: ledgerEntries, error: ledgerError } = await supabase
    .from('rlc_split_ledger_entries')
    .select('id, amount, status, stripe_transfer_id, recipient_chapter_id, reversal_of_id')
    .eq('contribution_id', contribRow.id)
    .is('reversal_of_id', null);

  if (ledgerError || !ledgerEntries || ledgerEntries.length === 0) {
    logger.info(`charge.refunded: No ledger entries for contribution ${contribRow.id}`);
    return;
  }

  const { reverseTransfer } = await import('@/lib/stripe/client');

  for (const entry of ledgerEntries) {
    const row = entry as {
      id: string;
      amount: number;
      status: string;
      stripe_transfer_id: string | null;
      recipient_chapter_id: string;
      reversal_of_id: string | null;
    };

    const entryAmountCents = Math.round(Number(row.amount) * 100);

    // Calculate proportional refund amount for partial refunds
    let reversalAmountCents = entryAmountCents;
    if (!isFullRefund) {
      const proportion = refundedAmountCents / contributionAmountCents;
      reversalAmountCents = Math.round(entryAmountCents * proportion);
    }

    if (row.status === 'transferred' && row.stripe_transfer_id) {
      // Reverse the Stripe transfer
      try {
        await reverseTransfer(row.stripe_transfer_id);
      } catch (reverseError) {
        logger.error(`Failed to reverse transfer ${row.stripe_transfer_id}:`, reverseError);
        // Mark as failed and continue
        await supabase
          .from('rlc_split_ledger_entries')
          .update({ status: 'failed' } as never)
          .eq('id', row.id);
        continue;
      }
    }

    // Create reversal ledger entry
    await supabase.from('rlc_split_ledger_entries').insert({
      contribution_id: contribRow.id,
      source_type: 'membership',
      recipient_chapter_id: row.recipient_chapter_id,
      amount: -(reversalAmountCents / 100),
      currency: 'USD',
      status: 'reversed',
      reversal_of_id: row.id,
      split_rule_snapshot: { reason: isFullRefund ? 'full_refund' : 'partial_refund', refunded_cents: refundedAmountCents },
    } as never);

    // Mark original as reversed
    await supabase
      .from('rlc_split_ledger_entries')
      .update({ status: 'reversed' } as never)
      .eq('id', row.id);
  }

  // Update contribution payment status
  await supabase
    .from('rlc_contributions')
    .update({ payment_status: isFullRefund ? 'refunded' : 'completed' } as never)
    .eq('id', contribRow.id);

  logger.info(
    `charge.refunded: Processed ${isFullRefund ? 'full' : 'partial'} refund for contribution ${contribRow.id} ` +
    `(${refundedAmountCents} cents refunded)`
  );
}
