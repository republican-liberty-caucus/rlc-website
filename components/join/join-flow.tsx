'use client';

import { useState } from 'react';
import type { TierConfig } from '@/lib/stripe/client';
import { JoinTierCard } from '@/components/join/tier-card';
import { EmbeddedCheckoutForm } from '@/components/join/embedded-checkout';

interface JoinFlowProps {
  tiers: TierConfig[];
}

interface ActiveCheckout {
  clientSecret: string;
  tier: TierConfig;
}

export function JoinFlow({ tiers }: JoinFlowProps) {
  const [checkout, setCheckout] = useState<ActiveCheckout | null>(null);

  function handleCheckout(clientSecret: string, tier: TierConfig) {
    setCheckout({ clientSecret, tier });
  }

  if (checkout) {
    return (
      <EmbeddedCheckoutForm
        clientSecret={checkout.clientSecret}
        tier={checkout.tier}
        onBack={() => setCheckout(null)}
      />
    );
  }

  // Split tiers into two rows: first 4 (standard), then remaining (premium)
  const primaryTiers = tiers.slice(0, 4);
  const premiumTiers = tiers.slice(4);

  return (
    <>
      {/* Primary tiers - 4 columns */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {primaryTiers.map((tier) => (
          <JoinTierCard key={tier.tier} tier={tier} onCheckout={handleCheckout} />
        ))}
      </div>

      {/* Premium tiers */}
      {premiumTiers.length > 0 && (
        <div className="mt-12">
          <h3 className="mb-6 text-center text-xl font-semibold text-muted-foreground">
            Leadership & Major Supporter Tiers
          </h3>
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
            {premiumTiers.map((tier) => (
              <JoinTierCard key={tier.tier} tier={tier} onCheckout={handleCheckout} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
