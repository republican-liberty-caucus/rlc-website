/**
 * One-time idempotent script to create persistent Stripe Products and Prices
 * for the RLC website membership tiers.
 *
 * These are PARALLEL products to HighLevel's — they use a [Website] prefix
 * and `source: 'rlc-website'` metadata to avoid cross-contamination.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/stripe-setup-products.ts
 *
 * Run once in test mode, once in live mode (switch STRIPE_SECRET_KEY).
 */

import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not set');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

interface TierDef {
  tier: string;
  name: string;
  description: string;
  priceCents: number;
  envVarName: string;
}

const TIERS: TierDef[] = [
  {
    tier: 'student_military',
    name: '[Website] RLC Student/Military Membership',
    description: 'Annual student/military membership — RLC website',
    priceCents: 3000,
    envVarName: 'STRIPE_PRICE_STUDENT_MILITARY',
  },
  {
    tier: 'individual',
    name: '[Website] RLC Individual Membership',
    description: 'Annual individual membership — RLC website',
    priceCents: 4500,
    envVarName: 'STRIPE_PRICE_INDIVIDUAL',
  },
  {
    tier: 'premium',
    name: '[Website] RLC Premium Membership',
    description: 'Annual premium membership (includes spouse) — RLC website',
    priceCents: 7500,
    envVarName: 'STRIPE_PRICE_PREMIUM',
  },
  {
    tier: 'sustaining',
    name: '[Website] RLC Sustaining Membership',
    description: 'Annual sustaining membership (family) — RLC website',
    priceCents: 15000,
    envVarName: 'STRIPE_PRICE_SUSTAINING',
  },
  {
    tier: 'patron',
    name: '[Website] RLC Patron Membership',
    description: 'Annual patron membership — RLC website',
    priceCents: 35000,
    envVarName: 'STRIPE_PRICE_PATRON',
  },
  {
    tier: 'benefactor',
    name: '[Website] RLC Benefactor Membership',
    description: 'Annual benefactor membership — RLC website',
    priceCents: 75000,
    envVarName: 'STRIPE_PRICE_BENEFACTOR',
  },
  {
    tier: 'roundtable',
    name: '[Website] RLC Roundtable Membership',
    description: 'Annual roundtable membership — RLC website',
    priceCents: 150000,
    envVarName: 'STRIPE_PRICE_ROUNDTABLE',
  },
];

async function findExistingProduct(tier: string): Promise<Stripe.Product | null> {
  // List all active products and filter by metadata (list API is immediately consistent,
  // unlike search API which is eventually consistent and can miss recently created products)
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const params: Stripe.ProductListParams = { active: true, limit: 100 };
    if (startingAfter) params.starting_after = startingAfter;

    const products = await stripe.products.list(params);

    for (const product of products.data) {
      if (product.metadata.source === 'rlc-website' && product.metadata.tier === tier) {
        return product;
      }
    }

    hasMore = products.has_more;
    if (products.data.length > 0) {
      startingAfter = products.data[products.data.length - 1].id;
    }
  }

  return null;
}

async function main() {
  console.log('=== Stripe Product Setup for RLC Website ===\n');

  const isLiveMode = STRIPE_SECRET_KEY!.startsWith('sk_live');
  console.log(`Mode: ${isLiveMode ? '🔴 LIVE' : '🟢 TEST'}\n`);

  const envLines: string[] = [];

  for (const tierDef of TIERS) {
    // Check for existing product (idempotency)
    const existing = await findExistingProduct(tierDef.tier);

    if (existing) {
      // Product exists — find its active yearly recurring price
      const prices = await stripe.prices.list({
        product: existing.id,
        active: true,
        type: 'recurring',
      });

      const yearlyPrice = prices.data.find(
        (p) => p.recurring?.interval === 'year'
      );

      if (yearlyPrice) {
        // Verify amount matches
        if (yearlyPrice.unit_amount !== tierDef.priceCents) {
          console.warn(
            `⚠️  ${tierDef.tier}: Price mismatch! Config: $${tierDef.priceCents / 100}, Stripe: $${(yearlyPrice.unit_amount || 0) / 100}. Using existing price.`
          );
        }
        console.log(`✓ ${tierDef.tier}: Already exists (product=${existing.id}, price=${yearlyPrice.id})`);
        envLines.push(`${tierDef.envVarName}=${yearlyPrice.id}`);
        continue;
      }

      // Product exists but no active price — create one
      const price = await stripe.prices.create({
        product: existing.id,
        unit_amount: tierDef.priceCents,
        currency: 'usd',
        recurring: { interval: 'year' },
      });

      console.log(`✓ ${tierDef.tier}: Product existed, created price=${price.id}`);
      envLines.push(`${tierDef.envVarName}=${price.id}`);
      continue;
    }

    // Create product + price
    const product = await stripe.products.create({
      name: tierDef.name,
      description: tierDef.description,
      metadata: {
        source: 'rlc-website',
        tier: tierDef.tier,
      },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: tierDef.priceCents,
      currency: 'usd',
      recurring: { interval: 'year' },
    });

    console.log(`+ ${tierDef.tier}: Created product=${product.id}, price=${price.id}`);
    envLines.push(`${tierDef.envVarName}=${price.id}`);
  }

  console.log('\n=== Environment Variables (copy to .env.local / Vercel) ===\n');
  console.log('# Stripe Product Price IDs (recurring annual, created by scripts/stripe-setup-products.ts)');
  for (const line of envLines) {
    console.log(line);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
