import Stripe from 'stripe';
import { headers } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { getStripe, MEMBERSHIP_TIERS } from '@/lib/stripe/client';
import { syncMemberToHighLevel } from '@/lib/highlevel/client';
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
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logger.error('Stripe webhook signature verification failed:', err);
    return new Response('', { status: 400 });
  }

  const supabase = createServerClient();

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

  // Create contribution record
  const { error: insertError } = await supabase.from('rlc_contributions').insert({
    member_id: member.id,
    contribution_type: 'membership',
    amount: (session.amount_total || 0) / 100,
    currency: session.currency?.toUpperCase() || 'USD',
    stripe_payment_intent_id: paymentIntentId,
    payment_status: 'completed',
    is_recurring: session.mode === 'subscription',
  } as never);

  if (insertError) {
    logger.error(`Failed to create contribution for member ${member.id}:`, insertError);
    throw insertError;
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

  const { error: insertError } = await supabase.from('rlc_contributions').insert({
    member_id: member.id,
    contribution_type: 'membership',
    amount: (invoice.amount_paid || 0) / 100,
    currency: invoice.currency?.toUpperCase() || 'USD',
    stripe_payment_intent_id: paymentIntentId,
    payment_status: 'completed',
    is_recurring: true,
  } as never);

  if (insertError) {
    logger.error(`Failed to record contribution for member ${member.id}:`, insertError);
    throw insertError;
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
    const { data } = await supabase
      .from('rlc_members')
      .select('id')
      .eq('id', memberId)
      .single();
    if (data) resolvedMemberId = (data as { id: string }).id;
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
