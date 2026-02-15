import Stripe from 'stripe';
import type { MembershipTier } from '@/types';

// Lazy initialization to avoid build-time errors when env vars aren't set
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
    });
  }
  return stripeClient;
}

// ===========================================
// Membership tier pricing configuration
// ===========================================

export interface TierConfig {
  tier: MembershipTier;
  name: string;
  price: number; // in cents (kept for display and fallback)
  stripePriceId: string | null; // null = fallback to price_data
  interval: 'year';
  description: string;
  features: string[];
  includesSpouse: boolean;
  includesFamily: boolean;
  featured: boolean;
}

// Map tier slugs to env var values for persistent Stripe Price IDs
const STRIPE_PRICE_MAP: Record<MembershipTier, string | undefined> = {
  student_military: process.env.STRIPE_PRICE_STUDENT_MILITARY,
  individual: process.env.STRIPE_PRICE_INDIVIDUAL,
  premium: process.env.STRIPE_PRICE_PREMIUM,
  sustaining: process.env.STRIPE_PRICE_SUSTAINING,
  patron: process.env.STRIPE_PRICE_PATRON,
  benefactor: process.env.STRIPE_PRICE_BENEFACTOR,
  roundtable: process.env.STRIPE_PRICE_ROUNDTABLE,
};

export const MEMBERSHIP_TIERS: TierConfig[] = [
  {
    tier: 'student_military',
    name: 'Student/Military',
    price: 3000,
    stripePriceId: STRIPE_PRICE_MAP.student_military || null,
    interval: 'year',
    description: 'Discounted membership for students and military service members',
    features: [
      'Full voting rights',
      'Member communications',
      'State charter membership',
      'RLC membership card',
    ],
    includesSpouse: false,
    includesFamily: false,
    featured: false,
  },
  {
    tier: 'individual',
    name: 'Individual',
    price: 4500,
    stripePriceId: STRIPE_PRICE_MAP.individual || null,
    interval: 'year',
    description: 'Standard membership for one person',
    features: [
      'Full voting rights',
      'Member communications',
      'State charter membership',
      'RLC membership card',
      'Convention delegate eligibility',
    ],
    includesSpouse: false,
    includesFamily: false,
    featured: true,
  },
  {
    tier: 'premium',
    name: 'Premium',
    price: 7500,
    stripePriceId: STRIPE_PRICE_MAP.premium || null,
    interval: 'year',
    description: 'Membership for you and your spouse',
    features: [
      'Everything in Individual',
      'Includes one spouse membership',
      'Priority event registration',
      'Quarterly leadership calls',
    ],
    includesSpouse: true,
    includesFamily: false,
    featured: false,
  },
  {
    tier: 'sustaining',
    name: 'Sustaining',
    price: 15000,
    stripePriceId: STRIPE_PRICE_MAP.sustaining || null,
    interval: 'year',
    description: 'Family membership with ongoing support',
    features: [
      'Everything in Premium',
      'Includes spouse + children',
      'Recognition as Sustaining Member',
      'Annual leadership dinner invitation',
    ],
    includesSpouse: true,
    includesFamily: true,
    featured: false,
  },
  {
    tier: 'patron',
    name: 'Patron',
    price: 35000,
    stripePriceId: STRIPE_PRICE_MAP.patron || null,
    interval: 'year',
    description: 'Major supporter of the liberty movement',
    features: [
      'Everything in Sustaining',
      'Recognition as Patron Member',
      'VIP event access',
      'Direct access to national leadership',
    ],
    includesSpouse: true,
    includesFamily: true,
    featured: false,
  },
  {
    tier: 'benefactor',
    name: 'Benefactor',
    price: 75000,
    stripePriceId: STRIPE_PRICE_MAP.benefactor || null,
    interval: 'year',
    description: 'Top-tier individual supporter',
    features: [
      'Everything in Patron',
      'Recognition as Benefactor Member',
      'Named sponsor opportunities',
      'Advisory board participation',
    ],
    includesSpouse: true,
    includesFamily: true,
    featured: false,
  },
  {
    tier: 'roundtable',
    name: 'Roundtable',
    price: 150000,
    stripePriceId: STRIPE_PRICE_MAP.roundtable || null,
    interval: 'year',
    description: 'Leadership roundtable membership',
    features: [
      'Everything in Benefactor',
      'Roundtable strategy sessions',
      'National board meeting attendance',
      'Highest recognition level',
    ],
    includesSpouse: true,
    includesFamily: true,
    featured: false,
  },
];

export function getTierConfig(tier: MembershipTier): TierConfig | undefined {
  return MEMBERSHIP_TIERS.find((t) => t.tier === tier);
}

/** Build payment description for Stripe dashboard (distinguishes from HighLevel signups) */
export function getMembershipPaymentDescription(tierConfig: TierConfig): string {
  let desc = `RLC Website Membership Signup - ${tierConfig.name}`;
  if (tierConfig.includesFamily) {
    desc += ' (Includes Family)';
  } else if (tierConfig.includesSpouse) {
    desc += ' (Includes Spouse)';
  }
  return desc;
}

// ===========================================
// Checkout session creation
// ===========================================

/**
 * Find or create a Stripe Customer scoped to the website.
 * Never searches Stripe by email (would find HighLevel-created Customers).
 * Instead: checks rlc_contacts for existing stripe_customer_id, or creates new.
 */
async function findOrCreateWebsiteCustomer(
  stripe: Stripe,
  email: string,
  memberId?: string
): Promise<Stripe.Customer> {
  // If we have a memberId, check for existing stripe_customer_id in the database
  if (memberId) {
    const { createServerClient } = await import('@/lib/supabase/server');
    const supabase = createServerClient();
    const { data } = await supabase
      .from('rlc_contacts')
      .select('stripe_customer_id')
      .eq('id', memberId)
      .single();

    const row = data as { stripe_customer_id: string | null } | null;
    if (row?.stripe_customer_id) {
      // Verify the customer still exists in Stripe
      try {
        const existing = await stripe.customers.retrieve(row.stripe_customer_id);
        if (!existing.deleted) {
          return existing as Stripe.Customer;
        }
      } catch (retrieveErr: unknown) {
        // Only fall through if the customer genuinely doesn't exist in Stripe
        const isNotFound =
          retrieveErr instanceof Error &&
          'code' in retrieveErr &&
          (retrieveErr as { code?: string }).code === 'resource_missing';
        if (!isNotFound) {
          throw retrieveErr; // Stripe outage, rate limit, auth error — let caller handle
        }
        // Customer deleted/missing in Stripe — create new below
      }
    }
  }

  // Create a new Customer scoped to our website
  const newCustomer = await stripe.customers.create({
    email,
    metadata: { source: 'rlc-website' },
  });

  // Save the customer ID to prevent duplicate Customers on next checkout
  if (memberId) {
    const { createServerClient: createClient } = await import('@/lib/supabase/server');
    const sb = createClient();
    const { error: saveError } = await sb
      .from('rlc_contacts')
      .update({ stripe_customer_id: newCustomer.id } as never)
      .eq('id', memberId);

    if (saveError) {
      const { logger } = await import('@/lib/logger');
      logger.error(
        `findOrCreateWebsiteCustomer: Failed to save stripe_customer_id ${newCustomer.id} for member ${memberId}:`,
        saveError
      );
      // Don't throw — the Customer was created and checkout can proceed.
      // But this MUST be investigated to prevent duplicate Customers.
    }
  }

  return newCustomer;
}

export async function createCheckoutSession(params: {
  tier: MembershipTier;
  memberEmail: string;
  memberId?: string;
  returnUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const tierConfig = getTierConfig(params.tier);

  if (!tierConfig) {
    throw new Error(`Invalid membership tier: ${params.tier}`);
  }

  const useSubscription = !!tierConfig.stripePriceId;
  const mode = useSubscription ? 'subscription' : 'payment';

  // Build line item: persistent Price ID (subscription) or dynamic price_data (fallback)
  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = tierConfig.stripePriceId
    ? { price: tierConfig.stripePriceId, quantity: 1 }
    : {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `RLC ${tierConfig.name} Membership`,
            description: tierConfig.description,
            metadata: { tier: params.tier },
          },
          unit_amount: tierConfig.price,
        },
        quantity: 1,
      };

  // Embedded mode: renders payment form in an iframe on our page
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    ui_mode: 'embedded',
    mode,
    line_items: [lineItem],
    metadata: {
      tier: params.tier,
      type: 'membership',
      source: 'rlc-website',
      member_id: params.memberId || '',
    },
    return_url: params.returnUrl,
  };

  if (useSubscription) {
    const customer = await findOrCreateWebsiteCustomer(stripe, params.memberEmail, params.memberId);
    sessionParams.customer = customer.id;
  } else {
    sessionParams.customer_email = params.memberEmail;
  }

  return stripe.checkout.sessions.create(sessionParams);
}

// ===========================================
// Donation checkout session creation
// ===========================================

export async function createDonationCheckoutSession(params: {
  amount: number; // in cents
  isRecurring: boolean;
  donorEmail: string;
  memberId?: string;
  charterId?: string;
  campaignId?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  const metadata: Record<string, string> = {
    type: 'donation',
    source: 'rlc-website',
    member_id: params.memberId || '',
    charter_id: params.charterId || '',
    campaign_id: params.campaignId || '',
  };

  if (params.isRecurring) {
    // Recurring donations require a Customer (subscription mode) — use website-scoped Customer
    const customer = await findOrCreateWebsiteCustomer(stripe, params.donorEmail, params.memberId);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'RLC Monthly Donation',
              description: `Monthly donation of $${(params.amount / 100).toFixed(2)}`,
            },
            unit_amount: params.amount,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      metadata,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    return session;
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: params.donorEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'RLC Donation',
            description: `One-time donation of $${(params.amount / 100).toFixed(2)}`,
          },
          unit_amount: params.amount,
        },
        quantity: 1,
      },
    ],
    metadata,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  return session;
}

/**
 * Format price in cents to display string
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

// ===========================================
// Stripe Connect (Dues Sharing)
// ===========================================

/** Create a Stripe Connect Express account for a charter */
export async function createConnectAccount(params: {
  charterName: string;
  charterEmail: string;
}): Promise<Stripe.Account> {
  const stripe = getStripe();
  return stripe.accounts.create({
    type: 'express',
    country: 'US',
    business_type: 'non_profit',
    business_profile: {
      name: params.charterName,
    },
    email: params.charterEmail,
    capabilities: {
      transfers: { requested: true },
    },
  });
}

/** Generate an account link for Stripe-hosted onboarding */
export async function createAccountLink(params: {
  stripeAccountId: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<Stripe.AccountLink> {
  const stripe = getStripe();
  return stripe.accountLinks.create({
    account: params.stripeAccountId,
    type: 'account_onboarding',
    return_url: params.returnUrl,
    refresh_url: params.refreshUrl,
  });
}

/** Retrieve a Stripe Connect account */
export async function getConnectAccount(stripeAccountId: string): Promise<Stripe.Account> {
  const stripe = getStripe();
  return stripe.accounts.retrieve(stripeAccountId);
}

/** Create a transfer to a Connected Account */
export async function createTransfer(params: {
  amount: number; // in cents
  destinationAccountId: string;
  transferGroup?: string;
  description?: string;
  idempotencyKey?: string;
}): Promise<Stripe.Transfer> {
  const stripe = getStripe();
  return stripe.transfers.create(
    {
      amount: params.amount,
      currency: 'usd',
      destination: params.destinationAccountId,
      transfer_group: params.transferGroup,
      description: params.description,
    },
    params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined
  );
}

/** Reverse a transfer (for refunds) */
export async function reverseTransfer(transferId: string): Promise<Stripe.TransferReversal> {
  const stripe = getStripe();
  return stripe.transfers.createReversal(transferId);
}
