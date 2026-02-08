'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

interface SearchResult {
  bill_id: number;
  bill_number: string;
  title: string;
  state: string;
  last_action_date: string;
  last_action: string;
}

interface Props {
  sessionId: string;
  onBillAdded: () => void;
}

export function LegiscanSearch({ sessionId, onBillAdded }: Props) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setError('');
    setResults([]);

    try {
      const params = new URLSearchParams({ q: query });
      if (state) params.set('state', state);

      const res = await fetch(`/api/v1/admin/scorecards/search-legiscan?${params}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Search failed');
        return;
      }

      setResults(data.results?.results || []);
    } catch {
      setError('Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function addBill(result: SearchResult) {
    setAdding(result.bill_id);

    try {
      // First get bill details for roll call IDs
      const detailRes = await fetch(`/api/v1/admin/scorecards/search-legiscan?billId=${result.bill_id}`);
      const detailData = await detailRes.json();
      const bill = detailData.bill;

      const lastRollCallId = bill?.votes?.[bill.votes.length - 1]?.roll_call_id || null;

      const res = await fetch(`/api/v1/admin/scorecards/${sessionId}/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legiscanBillId: result.bill_id,
          billNumber: result.bill_number,
          title: result.title,
          description: bill?.description || null,
          libertyPosition: 'yea', // Default — admin will review
          legiscanRollCallId: lastRollCallId,
        }),
      });

      if (res.ok) {
        onBillAdded();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to add bill');
      }
    } catch {
      setError('Failed to add bill');
    } finally {
      setAdding(null);
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="mb-4 flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search bills (e.g. 'gun rights', 'tax reform')"
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={state}
          onChange={(e) => setState(e.target.value.toUpperCase())}
          placeholder="State (e.g. TX)"
          maxLength={2}
          className="w-20 rounded-md border bg-background px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={searching} variant="outline" size="sm">
          <Search className="mr-2 h-4 w-4" />
          {searching ? 'Searching...' : 'Search'}
        </Button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {results.length > 0 && (
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {results.map((r) => (
            <div key={r.bill_id} className="flex items-center justify-between rounded-md border bg-background p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-medium">{r.bill_number}</span>
                  <span className="text-xs text-muted-foreground">{r.state}</span>
                </div>
                <p className="truncate text-sm text-muted-foreground">{r.title}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addBill(r)}
                disabled={adding === r.bill_id}
                className="ml-3 shrink-0"
              >
                {adding === r.bill_id ? 'Adding...' : 'Add'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
