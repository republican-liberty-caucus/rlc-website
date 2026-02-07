import Stripe from 'stripe';
import { headers } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import type { Member } from '@/types';

// Lazy initialization to avoid build-time errors when env vars aren't set
let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeClient) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    stripeClient = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });
  }
  return stripeClient;
}

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    console.error('Stripe webhook: Missing stripe-signature header');
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('Stripe webhook: STRIPE_WEBHOOK_SECRET not configured');
    return new Response('Webhook secret not configured', { status: 500 });
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err);
    return new Response('Webhook signature verification failed', { status: 400 });
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
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Error processing Stripe webhook:', error);
    return new Response('Webhook processing failed', { status: 500 });
  }

  return new Response('', { status: 200 });
}

async function handleCheckoutComplete(
  supabase: ReturnType<typeof createServerClient>,
  session: Stripe.Checkout.Session
) {
  const customerId = session.customer as string;
  const memberEmail = session.customer_email;

  if (!memberEmail) return;

  // Find the member by email
  const { data, error: selectError } = await supabase
    .from('rlc_members')
    .select('*')
    .eq('email', memberEmail)
    .single();

  if (selectError && selectError.code !== 'PGRST116') {
    console.error('Error finding member:', selectError);
    throw selectError;
  }

  const member = data as Member | null;

  if (!member) {
    console.error('Member not found for checkout session:', memberEmail);
    return;
  }

  // Update member with Stripe customer ID
  const { error: updateError } = await supabase
    .from('rlc_members')
    .update({ stripe_customer_id: customerId } as never)
    .eq('id', member.id);

  if (updateError) {
    console.error(`Failed to update member ${member.id} with Stripe customer ID:`, updateError);
    throw updateError;
  }

  // Create contribution record
  const { error: insertError } = await supabase.from('rlc_contributions').insert({
    member_id: member.id,
    contribution_type: session.metadata?.type || 'donation',
    amount: (session.amount_total || 0) / 100,
    currency: session.currency?.toUpperCase() || 'USD',
    stripe_payment_intent_id: session.payment_intent as string,
    payment_status: 'completed',
    is_recurring: session.mode === 'subscription',
  } as never);

  if (insertError) {
    console.error(`Failed to create contribution for member ${member.id}:`, insertError);
    throw insertError;
  }

  console.log(`Checkout completed for member ${member.id}`);
}

async function handleSubscriptionChange(
  supabase: ReturnType<typeof createServerClient>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;

  // Find member by Stripe customer ID
  const { data, error: selectError } = await supabase
    .from('rlc_members')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (selectError && selectError.code !== 'PGRST116') {
    console.error('Error finding member by Stripe customer ID:', selectError);
    throw selectError;
  }

  const member = data as Member | null;

  if (!member) {
    console.error('Member not found for subscription:', customerId);
    return;
  }

  // Update membership status based on subscription status
  const membershipStatus = subscription.status === 'active' ? 'active' : 'pending';
  const membershipTier = 'sustaining'; // Subscriptions are sustaining members

  const { error: updateError } = await supabase
    .from('rlc_members')
    .update({
      membership_status: membershipStatus,
      membership_tier: membershipTier,
      membership_start_date: new Date(subscription.current_period_start * 1000).toISOString(),
      membership_expiry_date: new Date(subscription.current_period_end * 1000).toISOString(),
    } as never)
    .eq('id', member.id);

  if (updateError) {
    console.error(`Failed to update subscription for member ${member.id}:`, updateError);
    throw updateError;
  }

  console.log(`Subscription updated for member ${member.id}: ${subscription.status}`);
}

async function handleSubscriptionCancelled(
  supabase: ReturnType<typeof createServerClient>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;

  // Find member by Stripe customer ID
  const { data, error: selectError } = await supabase
    .from('rlc_members')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (selectError && selectError.code !== 'PGRST116') {
    console.error('Error finding member by Stripe customer ID:', selectError);
  }

  const member = data as Member | null;

  if (!member) return;

  // Update membership status to expired
  const { error: updateError } = await supabase
    .from('rlc_members')
    .update({ membership_status: 'expired' } as never)
    .eq('id', member.id);

  if (updateError) {
    console.error(`Failed to cancel subscription for member ${member.id}:`, updateError);
    throw updateError;
  }

  console.log(`Subscription cancelled for member ${member.id}`);
}

async function handleInvoicePaid(
  supabase: ReturnType<typeof createServerClient>,
  invoice: Stripe.Invoice
) {
  const customerId = invoice.customer as string;

  // Find member by Stripe customer ID
  const { data, error: selectError } = await supabase
    .from('rlc_members')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (selectError && selectError.code !== 'PGRST116') {
    console.error('Error finding member by Stripe customer ID:', selectError);
  }

  const member = data as Member | null;

  if (!member) return;

  // Record the contribution
  const { error: insertError } = await supabase.from('rlc_contributions').insert({
    member_id: member.id,
    contribution_type: 'membership',
    amount: (invoice.amount_paid || 0) / 100,
    currency: invoice.currency?.toUpperCase() || 'USD',
    stripe_payment_intent_id: invoice.payment_intent as string,
    payment_status: 'completed',
    is_recurring: true,
  } as never);

  if (insertError) {
    console.error(`Failed to record contribution for member ${member.id}:`, insertError);
    throw insertError;
  }

  console.log(`Invoice paid for member ${member.id}`);
}

async function handleInvoiceFailed(
  supabase: ReturnType<typeof createServerClient>,
  invoice: Stripe.Invoice
) {
  const customerId = invoice.customer as string;

  // Find member by Stripe customer ID
  const { data, error: selectError } = await supabase
    .from('rlc_members')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (selectError && selectError.code !== 'PGRST116') {
    console.error('Error finding member by Stripe customer ID:', selectError);
  }

  const member = data as Member | null;

  if (!member) return;

  // Record the failed contribution
  const { error: insertError } = await supabase.from('rlc_contributions').insert({
    member_id: member.id,
    contribution_type: 'membership',
    amount: (invoice.amount_due || 0) / 100,
    currency: invoice.currency?.toUpperCase() || 'USD',
    stripe_payment_intent_id: invoice.payment_intent as string,
    payment_status: 'failed',
    is_recurring: true,
  } as never);

  if (insertError) {
    console.error(`Failed to record failed contribution for member ${member.id}:`, insertError);
    throw insertError;
  }

  console.log(`Invoice failed for member ${member.id}`);
}
