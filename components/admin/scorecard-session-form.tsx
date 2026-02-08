'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { slugify } from '@/lib/utils';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
];

export function ScorecardSessionForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [jurisdiction, setJurisdiction] = useState<'federal' | 'state'>('federal');
  const [stateCode, setStateCode] = useState('');
  const [sessionYear, setSessionYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleNameChange(value: string) {
    setName(value);
    setSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/admin/scorecards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          jurisdiction,
          stateCode: jurisdiction === 'state' ? stateCode : undefined,
          sessionYear,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create session');
        return;
      }

      router.push(`/admin/scorecards/${data.session.id}`);
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">Session Name</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. 119th Congress (2025-2026)"
          required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="slug" className="text-sm font-medium">URL Slug</label>
        <input
          id="slug"
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="jurisdiction" className="text-sm font-medium">Jurisdiction</label>
        <select
          id="jurisdiction"
          value={jurisdiction}
          onChange={(e) => setJurisdiction(e.target.value as 'federal' | 'state')}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="federal">Federal</option>
          <option value="state">State</option>
        </select>
      </div>

      {jurisdiction === 'state' && (
        <div className="space-y-2">
          <label htmlFor="stateCode" className="text-sm font-medium">State</label>
          <select
            id="stateCode"
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
            required
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select state...</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="year" className="text-sm font-medium">Session Year</label>
        <input
          id="year"
          type="number"
          value={sessionYear}
          onChange={(e) => setSessionYear(Number(e.target.value))}
          min={2000}
          max={2100}
          required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <Button type="submit" disabled={loading} className="bg-rlc-red hover:bg-rlc-red/90">
        {loading ? 'Creating...' : 'Create Session'}
      </Button>
    </form>
  );
}
