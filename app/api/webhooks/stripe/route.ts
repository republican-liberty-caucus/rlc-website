import Stripe from 'stripe';
import { headers } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { getStripe, MEMBERSHIP_TIERS, getTierConfig, getMembershipPaymentDescription } from '@/lib/stripe/client';
import { syncMemberToHighLevel } from '@/lib/highlevel/client';
import { triggerWelcomeSequence } from '@/lib/highlevel/notifications';
import { processDuesSplit, resolveCharterByState } from '@/lib/dues-sharing/split-engine';
import type { Contact, MembershipTier, MembershipStatus } from '@/types';
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
): Promise<Contact | null> {
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

  return data as Contact;
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
    // 42P01 (Postgres) / PGRST205 (PostgREST) = table doesn't exist — gracefully fall through
    if (idempotencyError && idempotencyError.code !== '42P01' && idempotencyError.code !== 'PGRST205') {
      logger.error('Webhook idempotency check failed:', idempotencyError);
    }
  } catch (idempotencyErr) {
    // Non-fatal — continue processing, but log so we know idempotency is broken
    logger.error('Webhook idempotency check threw an unexpected error (processing will continue):', idempotencyErr);
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
  // Source guard: skip events without metadata.type (likely HighLevel or external)
  const checkoutType = session.metadata?.type;
  if (!checkoutType) {
    logger.info(`Checkout session ${session.id} has no metadata.type — likely external, skipping`);
    return;
  }

  if (checkoutType === 'donation') {
    await handleDonationCheckout(supabase, session);
    return;
  }

  const customerId = session.customer as string;
  const tier = session.metadata?.tier;
  const memberId = session.metadata?.member_id;

  // Resolve email: subscription mode uses customer (not customer_email), so fetch from Customer
  let memberEmail = session.customer_email;
  let stripeCustomer: Stripe.Customer | Stripe.DeletedCustomer | null = null;
  if (!memberEmail && customerId) {
    const stripe = getStripe();
    stripeCustomer = await stripe.customers.retrieve(customerId);
    if (!stripeCustomer.deleted && stripeCustomer.email) {
      memberEmail = stripeCustomer.email;
    }
  }

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
  let member: Contact | null = null;

  if (memberId) {
    const { data, error } = await supabase
      .from('rlc_members')
      .select('*')
      .eq('id', memberId)
      .single();
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database error looking up member_id="${memberId}": ${error.message}`);
    }
    member = data as Contact | null;
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
    member = data as Contact | null;
  }

  if (!member) {
    // New member from email-only checkout — create record from Stripe data
    if (!customerId) {
      logger.error(
        `Checkout session ${session.id}: No member found and no customer ID to create one. ` +
        `email=${memberEmail}, member_id=${memberId}`
      );
      throw new Error(`Cannot create member for checkout ${session.id}: no Stripe customer ID`);
    }

    // Use session.customer_details.name (collected on the Stripe Checkout page)
    // then fall back to Stripe Customer record, then fall back to empty
    const checkoutName = session.customer_details?.name || '';
    let customerName = checkoutName;
    if (!customerName) {
      if (!stripeCustomer) {
        const stripe = getStripe();
        stripeCustomer = await stripe.customers.retrieve(customerId);
      }
      customerName = (!stripeCustomer.deleted && stripeCustomer.name) || '';
    }
    const [firstName, ...lastParts] = customerName.split(' ');
    const resolvedFirst = firstName || '';
    const resolvedLast = lastParts.join(' ') || '';

    if (!resolvedFirst && !resolvedLast) {
      logger.warn(
        `Auto-creating member for checkout ${session.id} with no name data. ` +
        `Stripe customer ${customerId}. Email: ${memberEmail}`
      );
    }

    const { data: newMember, error: createError } = await supabase
      .from('rlc_members')
      .insert({
        email: memberEmail,
        first_name: resolvedFirst || memberEmail.split('@')[0],
        last_name: resolvedLast || '',
        stripe_customer_id: customerId,
      } as never)
      .select('*')
      .single();

    if (createError) {
      // Handle race condition: concurrent webhook created the member already
      if (createError.code === '23505') {
        const { data: existingMember } = await supabase
          .from('rlc_members')
          .select('*')
          .eq('email', memberEmail)
          .single();
        if (existingMember) {
          member = existingMember as Contact;
          logger.info(`Concurrent creation resolved: found existing member for ${memberEmail}`);
        } else {
          logger.error(`Race condition: 23505 on insert but member not found for ${memberEmail}`);
          throw createError;
        }
      } else {
        logger.error(`Failed to create member for checkout ${session.id}:`, createError);
        throw createError;
      }
    } else {
      member = newMember as Contact;
      logger.info(`Created new member ${member.id} from checkout (email=${memberEmail})`);
    }
  }

  // Idempotency: check if this payment was already processed.
  // For subscription checkouts, payment_intent may be null — resolve from the subscription's invoice.
  let paymentIntentId = (session.payment_intent as string | null) || null;
  if (!paymentIntentId && session.subscription) {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string, {
      expand: ['latest_invoice'],
    });
    const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null;
    if (latestInvoice?.payment_intent) {
      paymentIntentId = latestInvoice.payment_intent as string;
    }
  }
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

  // Set descriptive payment description (matches CiviCRM format for Stripe dashboard)
  if (paymentIntentId) {
    const tierConfig = getTierConfig(membershipTier);
    if (tierConfig) {
      try {
        const stripe = getStripe();
        await stripe.paymentIntents.update(paymentIntentId, {
          description: getMembershipPaymentDescription(tierConfig),
        });
      } catch (descError) {
        logger.error('Failed to set payment description (non-fatal):', descError);
      }
    }
  }

  // Auto-assign state charter if not already set
  let assignedCharterId = member.primary_charter_id;
  if (!assignedCharterId) {
    const stateCode = member.state || session.customer_details?.address?.state || null;
    if (stateCode) {
      try {
        assignedCharterId = await resolveCharterByState(stateCode);
        if (assignedCharterId) {
          logger.info(`Auto-assigned charter for member ${member.id}: state=${stateCode}, charter=${assignedCharterId}`);
        }
      } catch (charterError) {
        logger.error(`Failed to resolve charter for state="${stateCode}" (non-fatal):`, charterError);
      }
    }
  }

  // Backfill member state from Stripe billing address if missing
  const resolvedState = member.state || session.customer_details?.address?.state || null;

  // Calculate membership dates: 1 year from now
  const now = new Date();
  const expiryDate = new Date(now);
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  // Update member with Stripe info, tier, dates, and charter assignment
  const { error: updateError } = await supabase
    .from('rlc_members')
    .update({
      stripe_customer_id: customerId,
      membership_tier: membershipTier,
      membership_status: 'new_member',
      membership_start_date: now.toISOString(),
      membership_expiry_date: expiryDate.toISOString(),
      membership_join_date: member.membership_join_date || now.toISOString(),
      ...(assignedCharterId && !member.primary_charter_id ? { primary_charter_id: assignedCharterId } : {}),
      ...(resolvedState && !member.state ? { state: resolvedState } : {}),
    } as never)
    .eq('id', member.id);

  if (updateError) {
    logger.error(`Failed to update member ${member.id}:`, updateError);
    throw updateError;
  }

  // Create contribution record — attribute to member's primary charter for dues splitting
  const { data: contributionRow, error: insertError } = await supabase
    .from('rlc_contributions')
    .insert({
      contact_id: member.id,
      contribution_type: 'membership',
      amount: (session.amount_total || 0) / 100,
      currency: session.currency?.toUpperCase() || 'USD',
      stripe_payment_intent_id: paymentIntentId,
      payment_status: 'completed',
      is_recurring: session.mode === 'subscription',
      charter_id: assignedCharterId || null,
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
    // Unknown customer — likely a HighLevel-originated subscription. Skip gracefully.
    logger.info(`handleSubscriptionChange: No member for customer ${customerId}, skipping (likely external)`);
    return;
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
    // Unknown customer — likely a HighLevel-originated subscription. Skip gracefully.
    logger.info(`handleSubscriptionCancelled: No member for customer ${customerId}, skipping (likely external)`);
    return;
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
  // Skip the first invoice of a subscription — handleCheckoutComplete already handled it.
  // This prevents double-counting the initial payment.
  if (invoice.billing_reason === 'subscription_create') {
    logger.info(`Invoice ${invoice.id} is subscription_create — skipping (handled by checkout)`);
    return;
  }

  const customerId = invoice.customer as string;
  const member = await findMemberByCustomerId(supabase, customerId, 'handleInvoicePaid');

  if (!member) {
    // Unknown customer — likely a HighLevel-originated subscription. Skip gracefully.
    logger.info(`handleInvoicePaid: No member for customer ${customerId}, skipping (likely external)`);
    return;
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

  // Set descriptive payment description for renewal (matches CiviCRM format)
  if (paymentIntentId && member.membership_tier) {
    const tierConfig = getTierConfig(member.membership_tier);
    if (tierConfig) {
      try {
        const stripe = getStripe();
        await stripe.paymentIntents.update(paymentIntentId, {
          description: `RLC Website Membership Renewal - ${tierConfig.name}`,
        });
      } catch (descError) {
        logger.error('Failed to set renewal payment description (non-fatal):', descError);
      }
    }
  }

  // Calculate renewal dates: extend from existing expiry (not now) to avoid penalizing early renewals
  const now = new Date();
  const existingExpiry = member.membership_expiry_date ? new Date(member.membership_expiry_date) : now;
  const renewalStart = existingExpiry > now ? existingExpiry : now; // If already expired, start from now
  const expiryDate = new Date(renewalStart);
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  // Update member expiry dates for renewal
  const { error: memberUpdateError } = await supabase
    .from('rlc_members')
    .update({
      membership_status: 'current',
      membership_start_date: renewalStart.toISOString(),
      membership_expiry_date: expiryDate.toISOString(),
    } as never)
    .eq('id', member.id);

  if (memberUpdateError) {
    logger.error(`Failed to update renewal dates for member ${member.id}:`, memberUpdateError);
    throw memberUpdateError;
  }

  // Attribute renewal to member's current charter (at time of renewal)
  const { data: contributionRow, error: insertError } = await supabase
    .from('rlc_contributions')
    .insert({
      contact_id: member.id,
      contribution_type: 'membership',
      amount: (invoice.amount_paid || 0) / 100,
      currency: invoice.currency?.toUpperCase() || 'USD',
      stripe_payment_intent_id: paymentIntentId,
      payment_status: 'completed',
      is_recurring: true,
      charter_id: member.primary_charter_id || null,
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

  // Sync renewal to HighLevel (non-fatal)
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
      membershipStatus: 'current',
      membershipStartDate: renewalStart.toISOString(),
      membershipExpiryDate: expiryDate.toISOString(),
      membershipJoinDate: member.membership_join_date || undefined,
    });
  } catch (hlError) {
    logger.error('HighLevel renewal sync failed (non-fatal):', hlError);
  }

  logger.info(`Invoice paid (renewal) for member ${member.id}`);
}

async function handleInvoiceFailed(
  supabase: ReturnType<typeof createServerClient>,
  invoice: Stripe.Invoice
) {
  const customerId = invoice.customer as string;
  const member = await findMemberByCustomerId(supabase, customerId, 'handleInvoiceFailed');

  if (!member) {
    // Unknown customer — likely a HighLevel-originated subscription. Skip gracefully.
    logger.info(`handleInvoiceFailed: No member for customer ${customerId}, skipping (likely external)`);
    return;
  }

  const { error: insertError } = await supabase.from('rlc_contributions').insert({
    contact_id: member.id,
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
  const charterId = session.metadata?.charter_id || null;
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
    contact_id: resolvedMemberId,
    contribution_type: 'donation',
    amount: (session.amount_total || 0) / 100,
    currency: session.currency?.toUpperCase() || 'USD',
    stripe_payment_intent_id: paymentIntentId,
    payment_status: 'completed',
    charter_id: charterId || null,
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

  // Find the charter stripe account
  const { data: charterAccount, error: lookupError } = await supabase
    .from('rlc_charter_stripe_accounts')
    .select('id, charter_id, status')
    .eq('stripe_account_id', stripeAccountId)
    .single();

  if (lookupError) {
    if (lookupError.code === 'PGRST116') {
      logger.info(`account.updated for unknown account ${stripeAccountId}, ignoring`);
      return;
    }
    logger.error(`account.updated: DB error looking up account ${stripeAccountId}:`, lookupError);
    throw new Error(`Database error in handleAccountUpdated: ${lookupError.message}`);
  }
  if (!charterAccount) {
    logger.info(`account.updated for unknown account ${stripeAccountId}, ignoring`);
    return;
  }

  const row = charterAccount as { id: string; charter_id: string; status: string };
  const chargesEnabled = account.charges_enabled ?? false;
  const payoutsEnabled = account.payouts_enabled ?? false;

  // Determine new status (never regress from 'active')
  let newStatus: string = row.status;
  if (chargesEnabled && payoutsEnabled) {
    newStatus = 'active';
  } else if (row.status !== 'active' && account.details_submitted) {
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
    .from('rlc_charter_stripe_accounts')
    .update(updatePayload as never)
    .eq('id', row.id);

  if (updateError) {
    logger.error(`Failed to update CharterStripeAccount for ${stripeAccountId}:`, updateError);
    throw updateError;
  }

  // If newly active, drain pending ledger entries
  if (newStatus === 'active' && row.status !== 'active') {
    await drainPendingLedgerEntries(supabase, row.charter_id, stripeAccountId);
  }

  logger.info(
    `account.updated: ${stripeAccountId} → status=${newStatus}, charges=${chargesEnabled}, payouts=${payoutsEnabled}`
  );
}

/** Transfer all pending ledger entries for a charter that just became active */
async function drainPendingLedgerEntries(
  supabase: ReturnType<typeof createServerClient>,
  charterId: string,
  stripeAccountId: string
) {
  // Import transfer function lazily to avoid circular deps
  const { executeTransfer } = await import('@/lib/dues-sharing/transfer-engine');

  // Atomic claim: UPDATE status to 'processing' WHERE status='pending', then SELECT
  // This prevents duplicate transfers if drain is called concurrently
  const { data: pendingEntries, error } = await supabase
    .from('rlc_split_ledger_entries')
    .update({ status: 'processing' } as never)
    .eq('recipient_charter_id', charterId)
    .eq('status', 'pending')
    .select('id, amount, stripe_transfer_group_id')
    .limit(50);

  if (error) {
    logger.error(`drainPendingLedgerEntries: Failed to claim pending entries for charter ${charterId}:`, error);
    throw new Error(`Database error draining pending entries: ${error.message}`);
  }
  if (!pendingEntries || pendingEntries.length === 0) return;

  if (pendingEntries.length === 50) {
    logger.warn(`drainPendingLedgerEntries: Batch limit reached for charter ${charterId}, more entries may remain`);
  }

  logger.info(`Draining ${pendingEntries.length} pending ledger entries for charter ${charterId}`);

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
      // executeTransfer already marks the entry as 'failed' on Stripe error
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
    .select('id, amount, contribution_type')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single();

  if (contribError) {
    if (contribError.code === 'PGRST116') {
      logger.info(`charge.refunded: No contribution found for pi=${paymentIntentId}`);
      return;
    }
    logger.error(`charge.refunded: DB error looking up contribution for pi=${paymentIntentId}:`, contribError);
    throw new Error(`Database error in handleChargeRefunded: ${contribError.message}`);
  }
  if (!contribution) {
    logger.info(`charge.refunded: No contribution found for pi=${paymentIntentId}`);
    return;
  }

  const contribRow = contribution as { id: string; amount: number; contribution_type: string };
  const contributionAmountCents = Math.round(Number(contribRow.amount) * 100);

  // Determine if full or partial refund
  const refundedAmountCents = charge.amount_refunded;
  const isFullRefund = refundedAmountCents >= contributionAmountCents;

  // Get original ledger entries for this contribution (excluding existing reversals)
  const { data: ledgerEntries, error: ledgerError } = await supabase
    .from('rlc_split_ledger_entries')
    .select('id, amount, status, stripe_transfer_id, recipient_charter_id, source_type')
    .eq('contribution_id', contribRow.id)
    .is('reversal_of_id', null);

  if (ledgerError) {
    logger.error(`charge.refunded: Failed to fetch ledger entries for ${contribRow.id}:`, ledgerError);
    throw new Error(`Database error fetching ledger entries: ${ledgerError.message}`);
  }

  if (!ledgerEntries || ledgerEntries.length === 0) {
    logger.info(`charge.refunded: No ledger entries for contribution ${contribRow.id}`);
    return;
  }

  // H3: Account for prior partial refunds by checking existing reversals
  let alreadyReversedCents = 0;
  if (!isFullRefund) {
    const { data: existingReversals } = await supabase
      .from('rlc_split_ledger_entries')
      .select('amount')
      .eq('contribution_id', contribRow.id)
      .not('reversal_of_id', 'is', null);

    if (existingReversals && existingReversals.length > 0) {
      alreadyReversedCents = existingReversals.reduce(
        (sum, r) => sum + Math.abs(Math.round(Number((r as { amount: number }).amount) * 100)),
        0
      );
    }
  }

  // Calculate the net new refund amount (what hasn't been reversed yet)
  const netRefundCents = isFullRefund
    ? contributionAmountCents
    : Math.max(0, refundedAmountCents - alreadyReversedCents);

  if (netRefundCents <= 0 && !isFullRefund) {
    logger.info(`charge.refunded: All refund amounts already reversed for ${contribRow.id}`);
    return;
  }

  const { reverseTransfer } = await import('@/lib/stripe/client');

  for (const entry of ledgerEntries) {
    const row = entry as {
      id: string;
      amount: number;
      status: string;
      stripe_transfer_id: string | null;
      recipient_charter_id: string;
      source_type: string;
    };

    // Skip entries already reversed or failed
    if (row.status === 'reversed' || row.status === 'failed') continue;

    const entryAmountCents = Math.round(Number(row.amount) * 100);

    // Calculate proportional refund amount
    let reversalAmountCents = entryAmountCents;
    if (!isFullRefund) {
      const proportion = netRefundCents / contributionAmountCents;
      reversalAmountCents = Math.round(entryAmountCents * proportion);
    }

    if (row.status === 'transferred' && row.stripe_transfer_id) {
      // Entry was transferred — reverse the Stripe transfer first
      try {
        await reverseTransfer(row.stripe_transfer_id);
      } catch (reverseError) {
        logger.error(`Failed to reverse transfer ${row.stripe_transfer_id}:`, reverseError);
        // Mark original as failed (Stripe reversal failed, money still at charter)
        const { error: failErr } = await supabase
          .from('rlc_split_ledger_entries')
          .update({ status: 'failed' } as never)
          .eq('id', row.id);
        if (failErr) {
          logger.error(`Failed to mark entry ${row.id} as failed:`, failErr);
        }
        continue;
      }

      // Stripe reversal succeeded — create reversal entry and mark original
      const { error: insertErr } = await supabase.from('rlc_split_ledger_entries').insert({
        contribution_id: contribRow.id,
        source_type: row.source_type,
        recipient_charter_id: row.recipient_charter_id,
        amount: -(reversalAmountCents / 100),
        currency: 'USD',
        status: 'reversed',
        reversal_of_id: row.id,
        split_rule_snapshot: { reason: isFullRefund ? 'full_refund' : 'partial_refund', refunded_cents: netRefundCents },
      } as never);

      if (insertErr) {
        logger.error(`Failed to insert reversal entry for ${row.id}:`, insertErr);
        throw new Error(`Database error inserting reversal: ${insertErr.message}`);
      }

      const { error: updateErr } = await supabase
        .from('rlc_split_ledger_entries')
        .update({ status: 'reversed' } as never)
        .eq('id', row.id);

      if (updateErr) {
        logger.error(`Failed to mark entry ${row.id} as reversed:`, updateErr);
        throw new Error(`Database error updating entry status: ${updateErr.message}`);
      }
    } else if (row.status === 'pending' || row.status === 'processing') {
      // C7: Entry was never transferred — mark as reversed directly (no Stripe call)
      const { error: insertErr } = await supabase.from('rlc_split_ledger_entries').insert({
        contribution_id: contribRow.id,
        source_type: row.source_type,
        recipient_charter_id: row.recipient_charter_id,
        amount: -(reversalAmountCents / 100),
        currency: 'USD',
        status: 'reversed',
        reversal_of_id: row.id,
        split_rule_snapshot: { reason: isFullRefund ? 'full_refund' : 'partial_refund', refunded_cents: netRefundCents },
      } as never);

      if (insertErr) {
        logger.error(`Failed to insert reversal entry for pending ${row.id}:`, insertErr);
        throw new Error(`Database error inserting reversal: ${insertErr.message}`);
      }

      const { error: updateErr } = await supabase
        .from('rlc_split_ledger_entries')
        .update({ status: 'reversed' } as never)
        .eq('id', row.id);

      if (updateErr) {
        logger.error(`Failed to mark pending entry ${row.id} as reversed:`, updateErr);
        throw new Error(`Database error updating entry status: ${updateErr.message}`);
      }
    }
  }

  // Update contribution payment status
  const { error: contribUpdateErr } = await supabase
    .from('rlc_contributions')
    .update({ payment_status: isFullRefund ? 'refunded' : 'completed' } as never)
    .eq('id', contribRow.id);

  if (contribUpdateErr) {
    logger.error(`Failed to update contribution ${contribRow.id} payment status:`, contribUpdateErr);
    throw new Error(`Database error updating contribution: ${contribUpdateErr.message}`);
  }

  logger.info(
    `charge.refunded: Processed ${isFullRefund ? 'full' : 'partial'} refund for contribution ${contribRow.id} ` +
    `(${refundedAmountCents} cents total refunded, ${netRefundCents} cents net new)`
  );
}
