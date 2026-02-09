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
  price: number; // in cents
  interval: 'year';
  description: string;
  features: string[];
  includesSpouse: boolean;
  includesFamily: boolean;
  featured: boolean;
}

export const MEMBERSHIP_TIERS: TierConfig[] = [
  {
    tier: 'student_military',
    name: 'Student/Military',
    price: 3000,
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

// ===========================================
// Checkout session creation
// ===========================================

export async function createCheckoutSession(params: {
  tier: MembershipTier;
  memberEmail: string;
  memberId?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const tierConfig = getTierConfig(params.tier);

  if (!tierConfig) {
    throw new Error(`Invalid membership tier: ${params.tier}`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: params.memberEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `RLC ${tierConfig.name} Membership`,
            description: tierConfig.description,
            metadata: {
              tier: params.tier,
            },
          },
          unit_amount: tierConfig.price,
        },
        quantity: 1,
      },
    ],
    metadata: {
      tier: params.tier,
      type: 'membership',
      member_id: params.memberId || '',
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  return session;
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
    member_id: params.memberId || '',
    charter_id: params.charterId || '',
    campaign_id: params.campaignId || '',
  };

  if (params.isRecurring) {
    // Create a price for the recurring donation
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: params.donorEmail,
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
}): Promise<Stripe.Transfer> {
  const stripe = getStripe();
  return stripe.transfers.create({
    amount: params.amount,
    currency: 'usd',
    destination: params.destinationAccountId,
    transfer_group: params.transferGroup,
    description: params.description,
  });
}

/** Reverse a transfer (for refunds) */
export async function reverseTransfer(transferId: string): Promise<Stripe.TransferReversal> {
  const stripe = getStripe();
  return stripe.transfers.createReversal(transferId);
}
