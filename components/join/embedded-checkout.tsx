'use client';

import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from '@stripe/react-stripe-js';
import { ArrowLeft } from 'lucide-react';
import type { TierConfig } from '@/lib/stripe/client';
import { formatPrice } from '@/lib/stripe/client';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

interface EmbeddedCheckoutFormProps {
  clientSecret: string;
  tier: TierConfig;
  onBack: () => void;
}

export function EmbeddedCheckoutForm({
  clientSecret,
  tier,
  onBack,
}: EmbeddedCheckoutFormProps) {
  return (
    <div className="mx-auto max-w-lg">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to membership options
      </button>

      {!stripePromise ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Payment system is temporarily unavailable. Please try again later.
        </div>
      ) : (
        <>
          <div className="mb-6 rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Selected membership</p>
            <p className="text-lg font-semibold">
              {tier.name} — {formatPrice(tier.price)}/year
            </p>
          </div>

          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </>
      )}
    </div>
  );
}
