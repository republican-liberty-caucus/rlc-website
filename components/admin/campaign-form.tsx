'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { slugify } from '@/lib/utils';

const CHAMBERS = [
  { value: '', label: 'All Chambers' },
  { value: 'us_house', label: 'US House' },
  { value: 'us_senate', label: 'US Senate' },
  { value: 'state_house', label: 'State House' },
  { value: 'state_senate', label: 'State Senate' },
] as const;

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
];

const DEFAULT_TEMPLATE = `Dear {representative},

I am writing as a constituent to express my position on [BILL/ISSUE].

As someone who values individual liberty and limited government, I urge you to [SUPPORT/OPPOSE] this measure.

Thank you for your service and for considering my views.

Sincerely,
[Your Name]`;

export function CampaignForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [targetChamber, setTargetChamber] = useState('');
  const [targetStateCode, setTargetStateCode] = useState('');
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_TEMPLATE);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleTitleChange(value: string) {
    setTitle(value);
    setSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug,
          description: description || undefined,
          targetChamber: targetChamber || undefined,
          targetStateCode: targetStateCode || undefined,
          messageTemplate: messageTemplate || undefined,
          startsAt: startsAt || undefined,
          endsAt: endsAt || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create campaign');
        return;
      }

      router.push(`/admin/campaigns/${data.campaign.id}`);
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      <div className="space-y-2">
        <label htmlFor="title" className="text-sm font-medium">Campaign Title</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="e.g. Stop the Federal Red Flag Law"
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
        <label htmlFor="description" className="text-sm font-medium">Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Brief description of what this campaign is about..."
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="targetChamber" className="text-sm font-medium">Target Chamber</label>
          <select
            id="targetChamber"
            value={targetChamber}
            onChange={(e) => setTargetChamber(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {CHAMBERS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="targetState" className="text-sm font-medium">Target State</label>
          <select
            id="targetState"
            value={targetStateCode}
            onChange={(e) => setTargetStateCode(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">All States</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="startsAt" className="text-sm font-medium">Start Date (optional)</label>
          <input
            id="startsAt"
            type="date"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="endsAt" className="text-sm font-medium">End Date (optional)</label>
          <input
            id="endsAt"
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="messageTemplate" className="text-sm font-medium">
          Message Template
          <span className="ml-2 text-xs text-muted-foreground">
            Use {'{representative}'} and {'{office}'} as placeholders
          </span>
        </label>
        <textarea
          id="messageTemplate"
          value={messageTemplate}
          onChange={(e) => setMessageTemplate(e.target.value)}
          rows={8}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
        />
      </div>

      <Button type="submit" disabled={loading} className="bg-rlc-red hover:bg-rlc-red/90">
        {loading ? 'Creating...' : 'Create Campaign'}
      </Button>
    </form>
  );
}
