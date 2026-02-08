'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Legislator } from '@/types';

type SortField = 'name' | 'party' | 'score' | 'state_code';
type SortDir = 'asc' | 'desc';

interface Props {
  legislators: (Legislator & { computed_score: number | null })[];
  scorecardSlug: string;
}

const chamberLabels: Record<string, string> = {
  us_house: 'House',
  us_senate: 'Senate',
  state_house: 'House',
  state_senate: 'Senate',
};

export function LegislatorTable({ legislators, scorecardSlug }: Props) {
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterParty, setFilterParty] = useState('');
  const [filterChamber, setFilterChamber] = useState('');
  const [search, setSearch] = useState('');

  const parties = useMemo(() => {
    const set = new Set(legislators.map((l) => l.party));
    return Array.from(set).sort();
  }, [legislators]);

  const chambers = useMemo(() => {
    const set = new Set(legislators.map((l) => l.chamber));
    return Array.from(set).sort();
  }, [legislators]);

  const filtered = useMemo(() => {
    let list = [...legislators];

    if (filterParty) list = list.filter((l) => l.party === filterParty);
    if (filterChamber) list = list.filter((l) => l.chamber === filterChamber);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((l) => l.name.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'name': return dir * a.name.localeCompare(b.name);
        case 'party': return dir * a.party.localeCompare(b.party);
        case 'state_code': return dir * a.state_code.localeCompare(b.state_code);
        case 'score': return dir * ((a.computed_score ?? -1) - (b.computed_score ?? -1));
        default: return 0;
      }
    });

    return list;
  }, [legislators, filterParty, filterChamber, search, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'score' ? 'desc' : 'asc');
    }
  }

  function sortIcon(field: SortField) {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  }

  function scoreColor(score: number | null): string {
    if (score === null) return 'text-muted-foreground';
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="rounded-md border bg-background px-3 py-2 text-sm"
        />
        <select
          value={filterParty}
          onChange={(e) => setFilterParty(e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">All Parties</option>
          {parties.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={filterChamber}
          onChange={(e) => setFilterChamber(e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">All Chambers</option>
          {chambers.map((c) => (
            <option key={c} value={c}>{chamberLabels[c] || c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">#</th>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-sm font-medium hover:text-foreground"
                  onClick={() => toggleSort('name')}
                >
                  Name{sortIcon('name')}
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-sm font-medium hover:text-foreground"
                  onClick={() => toggleSort('party')}
                >
                  Party{sortIcon('party')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">Chamber</th>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-sm font-medium hover:text-foreground"
                  onClick={() => toggleSort('state_code')}
                >
                  State{sortIcon('state_code')}
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right text-sm font-medium hover:text-foreground"
                  onClick={() => toggleSort('score')}
                >
                  Score{sortIcon('score')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((leg, idx) => (
                <tr key={leg.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm text-muted-foreground">{idx + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <Link
                      href={`/scorecards/${scorecardSlug}/${leg.id}`}
                      className="text-rlc-blue hover:underline"
                    >
                      {leg.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">{leg.party}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{chamberLabels[leg.chamber] || leg.chamber}</td>
                  <td className="px-4 py-3 text-sm">{leg.state_code}{leg.district ? `-${leg.district}` : ''}</td>
                  <td className={`px-4 py-3 text-right text-sm font-semibold ${scoreColor(leg.computed_score)}`}>
                    {leg.computed_score !== null ? `${leg.computed_score}%` : 'N/A'}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {legislators.length === 0
                      ? 'No legislators scored yet.'
                      : 'No legislators match your filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Showing {filtered.length} of {legislators.length} legislators
      </p>
    </div>
  );
}
