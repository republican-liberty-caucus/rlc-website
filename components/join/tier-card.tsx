'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Users } from 'lucide-react';
import type { TierConfig } from '@/lib/stripe/client';
import { formatPrice } from '@/lib/stripe/client';

interface TierCardProps {
  tier: TierConfig;
}

export function JoinTierCard({ tier }: TierCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tier.tier }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to start checkout');
      }

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        // If checkout requires email (unauthenticated), redirect to sign-up with tier
        window.location.href = `/sign-up?tier=${tier.tier}`;
      }
    } catch (err) {
      console.error('Failed to start checkout:', err);
      setError('Unable to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`relative flex flex-col rounded-lg border ${
        tier.featured
          ? 'border-rlc-red shadow-lg ring-1 ring-rlc-red'
          : 'border-border'
      } bg-card p-6`}
    >
      {tier.featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-rlc-red px-3 py-1 text-xs font-semibold text-white">
          Most Popular
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-xl font-semibold">{tier.name}</h3>
        <div className="mt-2">
          <span className="text-3xl font-bold">{formatPrice(tier.price)}</span>
          <span className="text-muted-foreground">/year</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
      </div>

      {(tier.includesSpouse || tier.includesFamily) && (
        <div className="mb-4 flex items-center gap-1.5 rounded-md bg-rlc-blue/5 px-3 py-1.5 text-xs font-medium text-rlc-blue">
          <Users className="h-3.5 w-3.5" />
          {tier.includesFamily ? 'Family membership' : 'Includes spouse'}
        </div>
      )}

      <ul className="mb-6 flex-1 space-y-2">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-rlc-red" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {error && (
        <p className="mb-2 text-center text-sm text-red-600">{error}</p>
      )}

      <Button
        onClick={handleJoin}
        disabled={loading}
        className={`w-full ${
          tier.featured
            ? 'bg-rlc-red hover:bg-rlc-red/90'
            : 'bg-rlc-blue hover:bg-rlc-blue/90'
        }`}
      >
        {loading ? 'Loading...' : `Join — ${formatPrice(tier.price)}/yr`}
      </Button>
    </div>
  );
}
