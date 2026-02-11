'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';
import { Plus, X, Search, Loader2 } from 'lucide-react';
import { ADMIN_INPUT_CLASS } from '@/components/admin/form-styles';
import { OFFICER_TITLE_LABELS, OFFICER_TITLES } from '@/lib/validations/officer-position';
import { formatDate } from '@/lib/utils';
import type { OfficerTitle } from '@/types';

interface OfficerRow {
  id: string;
  title: OfficerTitle;
  committee_name: string | null;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
  notes: string | null;
  member: { id: string; first_name: string; last_name: string; email: string } | null;
  appointed_by: { first_name: string; last_name: string } | null;
}

interface CharterOfficersCardProps {
  charterId: string;
  officers: OfficerRow[];
}

interface SearchResult {
  id: string;
  name: string;
}

function MemberSearchInput({
  charterId,
  selectedMember,
  onSelect,
}: {
  charterId: string;
  selectedMember: SearchResult | null;
  onSelect: (member: SearchResult | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSearch(value: string) {
    setQuery(value);
    onSelect(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/v1/admin/members/search?q=${encodeURIComponent(value)}&charter_id=${charterId}`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.members);
          setOpen(true);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  if (selectedMember) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-sm">
          {selectedMember.name}
        </span>
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setQuery('');
          }}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search by name or email..."
          className={`${ADMIN_INPUT_CLASS} pl-8`}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onSelect(m);
                  setOpen(false);
                  setQuery(m.name);
                }}
              >
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover p-3 text-center text-sm text-muted-foreground shadow-md">
          No members found
        </div>
      )}
    </div>
  );
}

export function CharterOfficersCard({ charterId, officers }: CharterOfficersCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<SearchResult | null>(null);

  const activeOfficers = officers.filter((o) => o.is_active);
  const pastOfficers = officers.filter((o) => !o.is_active);

  async function handleAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!selectedMember) {
      toast({ title: 'Error', description: 'Please select a member', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const body = {
      memberId: selectedMember.id,
      title: fd.get('title') as string,
      committeeName: (fd.get('committeeName') as string) || null,
      notes: (fd.get('notes') as string) || null,
    };

    try {
      const res = await fetch(`/api/v1/admin/charters/${charterId}/officers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to assign officer' }));
        throw new Error(err.error);
      }

      toast({ title: 'Officer assigned' });
      setShowForm(false);
      setSelectedMember(null);
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign officer',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEndPosition(positionId: string) {
    setEndingId(positionId);
    try {
      const res = await fetch(`/api/v1/admin/charters/${charterId}/officers/${positionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endedAt: new Date().toISOString(), isActive: false }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to end position' }));
        throw new Error(err.error);
      }

      toast({ title: 'Position ended' });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to end position',
        variant: 'destructive',
      });
    } finally {
      setEndingId(null);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Officers</h2>
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleAssign} className="mb-4 space-y-3 rounded border bg-muted/30 p-3">
          <div>
            <label className="block text-xs font-medium mb-1">Member</label>
            <MemberSearchInput
              charterId={charterId}
              selectedMember={selectedMember}
              onSelect={setSelectedMember}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Title</label>
            <select name="title" required className={ADMIN_INPUT_CLASS}>
              {OFFICER_TITLES.map((t) => (
                <option key={t} value={t}>{OFFICER_TITLE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Committee Name (if applicable)</label>
            <input name="committeeName" className={ADMIN_INPUT_CLASS} placeholder="e.g. Chartering Committee" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Notes (optional)</label>
            <input name="notes" className={ADMIN_INPUT_CLASS} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting || !selectedMember} className="bg-rlc-red hover:bg-rlc-red/90">
              {submitting ? 'Assigning...' : 'Assign'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); setSelectedMember(null); }}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {activeOfficers.length > 0 ? (
        <ul className="space-y-3">
          {activeOfficers.map((o) => (
            <li key={o.id} className="flex items-start justify-between border-b pb-2 last:border-0 last:pb-0">
              <div>
                <span className="text-sm font-medium">
                  {OFFICER_TITLE_LABELS[o.title]}
                  {o.committee_name && ` — ${o.committee_name}`}
                </span>
                <p className="text-xs text-muted-foreground">
                  {o.member ? `${o.member.first_name} ${o.member.last_name}` : 'Unknown'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Since {formatDate(o.started_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEndPosition(o.id)}
                disabled={endingId === o.id}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                title="End position"
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No active officers</p>
      )}

      {pastOfficers.length > 0 && (
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs font-medium text-muted-foreground mb-2">Past Officers</p>
          <ul className="space-y-1">
            {pastOfficers.slice(0, 5).map((o) => (
              <li key={o.id} className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {OFFICER_TITLE_LABELS[o.title]} — {o.member ? `${o.member.first_name} ${o.member.last_name}` : 'Unknown'}
                </span>
                <span>{o.ended_at ? formatDate(o.ended_at) : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
