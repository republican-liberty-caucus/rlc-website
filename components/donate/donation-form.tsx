'use client';

import * as React from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';

const PRESET_AMOUNTS = [25, 50, 100, 250, 500, 1000];

interface DonationFormProps {
  chapters: { id: string; name: string }[];
}

export function DonationForm({ chapters }: DonationFormProps) {
  const { user } = useUser();
  const [selectedAmount, setSelectedAmount] = React.useState<number | null>(100);
  const [customAmount, setCustomAmount] = React.useState('');
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [chapterId, setChapterId] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Pre-fill email for signed-in users
  React.useEffect(() => {
    if (user?.primaryEmailAddress?.emailAddress) {
      setEmail(user.primaryEmailAddress.emailAddress);
    }
  }, [user]);

  const effectiveAmount = customAmount
    ? Math.round(parseFloat(customAmount) * 100)
    : selectedAmount
      ? selectedAmount * 100
      : 0;

  async function handleDonate() {
    if (effectiveAmount < 100) {
      setError('Minimum donation is $1.00');
      return;
    }

    if (!email) {
      setError('Email is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/donate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: effectiveAmount,
          isRecurring,
          email,
          chapterId: chapterId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to start donation');
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-8">
      <h2 className="mb-6 text-2xl font-bold text-center">Make a Contribution</h2>

      {/* Amount Selection */}
      <div className="mb-6">
        <label className="mb-3 block text-sm font-medium">Select Amount</label>
        <div className="grid grid-cols-3 gap-3">
          {PRESET_AMOUNTS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => {
                setSelectedAmount(amount);
                setCustomAmount('');
              }}
              className={`rounded-lg border-2 p-4 text-center font-semibold transition-colors ${
                selectedAmount === amount && !customAmount
                  ? 'border-rlc-red bg-rlc-red/10 text-rlc-red'
                  : 'border-muted bg-background hover:border-rlc-red'
              }`}
            >
              ${amount}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-sm text-muted-foreground">
            Or enter a custom amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <input
              type="number"
              min="1"
              max="100000"
              step="0.01"
              placeholder="0.00"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setSelectedAmount(null);
              }}
              className="w-full rounded-lg border bg-background pl-8 pr-4 py-3 focus:border-rlc-red focus:outline-none focus:ring-1 focus:ring-rlc-red"
            />
          </div>
        </div>
      </div>

      {/* Frequency */}
      <div className="mb-6">
        <label className="mb-3 block text-sm font-medium">Donation Frequency</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setIsRecurring(false)}
            className={`flex-1 rounded-lg border-2 p-3 text-center font-medium transition-colors ${
              !isRecurring
                ? 'border-rlc-red bg-rlc-red/10 text-rlc-red'
                : 'border-muted bg-background hover:border-rlc-red'
            }`}
          >
            One-time
          </button>
          <button
            type="button"
            onClick={() => setIsRecurring(true)}
            className={`flex-1 rounded-lg border-2 p-3 text-center font-medium transition-colors ${
              isRecurring
                ? 'border-rlc-red bg-rlc-red/10 text-rlc-red'
                : 'border-muted bg-background hover:border-rlc-red'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Email */}
      {!user && (
        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium">Email Address</label>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border bg-background px-4 py-3 focus:border-rlc-red focus:outline-none focus:ring-1 focus:ring-rlc-red"
          />
        </div>
      )}

      {/* Chapter Attribution */}
      {chapters.length > 0 && (
        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium">
            Attribute to a Chapter <span className="text-muted-foreground">(optional)</span>
          </label>
          <select
            value={chapterId}
            onChange={(e) => setChapterId(e.target.value)}
            className="w-full rounded-lg border bg-background px-4 py-3 focus:border-rlc-red focus:outline-none focus:ring-1 focus:ring-rlc-red"
          >
            <option value="">National (no specific chapter)</option>
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Donate Button */}
      <Button
        className="w-full bg-rlc-red hover:bg-rlc-red/90"
        size="lg"
        disabled={loading || effectiveAmount < 100}
        onClick={handleDonate}
      >
        {loading
          ? 'Redirecting to checkout...'
          : `Donate ${effectiveAmount >= 100 ? `$${(effectiveAmount / 100).toFixed(2)}` : ''} ${isRecurring ? '/month' : ''}`}
      </Button>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Contributions to the Republican Liberty Caucus are not tax-deductible. The RLC is a
        527 political organization.
      </p>
    </div>
  );
}
