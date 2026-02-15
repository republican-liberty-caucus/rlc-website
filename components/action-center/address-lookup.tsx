'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Search, Landmark, Building2, MapPin, Scale, Building } from 'lucide-react';
import { RepCard } from '@/components/action-center/rep-card';
import type { OfficialCategory } from '@/lib/civic/client';

interface Official {
  name: string;
  party: string;
  phones: string[];
  emails: string[];
  photoUrl: string | null;
  urls: string[];
  channels: Array<{ type: string; id: string }>;
  office: string;
  category: OfficialCategory;
}

const CATEGORY_CONFIG: Record<OfficialCategory, { label: string; icon: typeof Landmark }> = {
  federal_legislature: { label: 'Federal Legislators', icon: Landmark },
  federal_executive: { label: 'Federal Executive', icon: Building2 },
  state_legislature: { label: 'State Legislators', icon: Scale },
  state_executive: { label: 'State Executive', icon: Building },
  local: { label: 'Local Officials', icon: MapPin },
};

const CATEGORY_ORDER: OfficialCategory[] = [
  'federal_legislature',
  'federal_executive',
  'state_legislature',
  'state_executive',
  'local',
];

interface Props {
  showResults?: boolean;
}

export function AddressLookup({ showResults = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [address, setAddress] = useState('');
  const [officials, setOfficials] = useState<Official[]>([]);
  const [normalizedAddress, setNormalizedAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<OfficialCategory, Official[]>();
    for (const o of officials) {
      const list = map.get(o.category) || [];
      list.push(o);
      map.set(o.category, list);
    }
    return CATEGORY_ORDER
      .filter((cat) => map.has(cat))
      .map((cat) => ({ category: cat, officials: map.get(cat)! }));
  }, [officials]);

  const doSearch = useCallback(async (query: string) => {
    setLoading(true);
    setError('');
    setOfficials([]);
    setSearched(true);

    try {
      const res = await fetch(`/api/v1/civic/representatives?address=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to look up representatives');
        return;
      }

      setOfficials(data.officials || []);
      setNormalizedAddress(data.normalizedAddress || null);
    } catch {
      setError('Failed to look up representatives');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-search when address query param is present
  useEffect(() => {
    const addressParam = searchParams.get('address');
    if (showResults && addressParam) {
      setAddress(addressParam);
      doSearch(addressParam);
    }
  }, [searchParams, showResults, doSearch]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;

    if (!showResults) {
      router.push(`/action-center/contact?address=${encodeURIComponent(address)}`);
      return;
    }

    doSearch(address);
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter your full address (e.g. 123 Main St, Austin, TX 78701)"
          className="flex-1 rounded-md border bg-background px-4 py-3"
          required
        />
        <Button type="submit" disabled={loading} className="bg-rlc-red hover:bg-rlc-red/90">
          <Search className="mr-2 h-4 w-4" />
          {loading ? 'Looking up...' : 'Find Reps'}
        </Button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {showResults && searched && grouped.length > 0 && (
        <div className="mt-8">
          {normalizedAddress && (
            <p className="mb-6 text-sm text-muted-foreground">
              Results for: <span className="font-medium text-foreground">{normalizedAddress}</span>
            </p>
          )}
          <div className="space-y-10">
            {grouped.map(({ category, officials: groupOfficials }) => {
              const { label, icon: Icon } = CATEGORY_CONFIG[category];
              return (
                <section key={category}>
                  <div className="mb-4 flex items-center gap-2 border-b pb-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-heading text-lg font-semibold">{label}</h3>
                    <span className="text-sm text-muted-foreground">({groupOfficials.length})</span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {groupOfficials.map((official, idx) => (
                      <RepCard key={`${official.name}-${idx}`} official={official} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {showResults && searched && officials.length === 0 && !loading && !error && (
        <p className="mt-8 text-center text-muted-foreground">
          No representatives found for this address. Try a more specific address.
        </p>
      )}
    </div>
  );
}
