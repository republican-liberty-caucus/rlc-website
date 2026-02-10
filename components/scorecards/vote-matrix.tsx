'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { ScoredLegislator, ScorecardBill, ScorecardVote } from '@/types';

interface VoteMatrixProps {
  legislators: ScoredLegislator[];
  bills: ScorecardBill[];
  votes: ScorecardVote[];
  scorecardSlug: string;
}

type SortField = 'name' | 'state' | 'score';

// Cell display for each vote type
function voteCell(vote: ScorecardVote | undefined) {
  if (!vote) {
    return <td className="border px-1 py-1 text-center text-xs text-muted-foreground">-</td>;
  }

  if (vote.vote === 'not_applicable') {
    return (
      <td className="border bg-gray-50 px-1 py-1 text-center text-xs italic text-gray-400 dark:bg-gray-900">
        NA
      </td>
    );
  }

  if (vote.vote === 'not_voting' || vote.vote === 'absent' || vote.vote === 'present') {
    return (
      <td className="border bg-gray-100 px-1 py-1 text-center text-xs text-gray-500 dark:bg-gray-800">
        NV
      </td>
    );
  }

  if (vote.aligned_with_liberty) {
    return (
      <td className="border bg-green-100 px-1 py-1 text-center text-xs font-semibold text-green-800 dark:bg-green-950 dark:text-green-400">
        1
      </td>
    );
  }

  return (
    <td className="border bg-red-100 px-1 py-1 text-center text-xs font-semibold text-red-800 dark:bg-red-950 dark:text-red-400">
      0
    </td>
  );
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

export function VoteMatrix({ legislators, bills, votes, scorecardSlug }: VoteMatrixProps) {
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('');
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sortedBills = useMemo(
    () => [...bills].sort((a, b) => a.sort_order - b.sort_order),
    [bills]
  );

  // Index votes by legislator_id -> bill_id for O(1) lookup
  const voteIndex = useMemo(() => {
    const idx = new Map<string, Map<string, ScorecardVote>>();
    for (const v of votes) {
      let legMap = idx.get(v.legislator_id);
      if (!legMap) {
        legMap = new Map();
        idx.set(v.legislator_id, legMap);
      }
      legMap.set(v.bill_id, v);
    }
    return idx;
  }, [votes]);

  // Compute votes-with-RLC count per legislator
  const legStats = useMemo(() => {
    const stats = new Map<string, { withRlc: number; totalVoted: number }>();
    for (const leg of legislators) {
      const legVotes = voteIndex.get(leg.id);
      let withRlc = 0;
      let totalVoted = 0;
      for (const bill of sortedBills) {
        const v = legVotes?.get(bill.id);
        if (v && v.vote !== 'not_applicable' && v.vote !== 'not_voting' && v.vote !== 'absent' && v.vote !== 'present') {
          totalVoted++;
          if (v.aligned_with_liberty) withRlc++;
        }
      }
      stats.set(leg.id, { withRlc, totalVoted });
    }
    return stats;
  }, [legislators, sortedBills, voteIndex]);

  const states = useMemo(() => {
    const set = new Set(legislators.map((l) => l.state_code));
    return Array.from(set).sort();
  }, [legislators]);

  const filtered = useMemo(() => {
    let list = [...legislators];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((l) => l.name.toLowerCase().includes(q));
    }
    if (filterState) {
      list = list.filter((l) => l.state_code === filterState);
    }

    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'name':
          return dir * a.name.localeCompare(b.name);
        case 'state':
          return dir * a.state_code.localeCompare(b.state_code);
        case 'score':
          return dir * ((a.computed_score ?? -1) - (b.computed_score ?? -1));
        default:
          return 0;
      }
    });

    return list;
  }, [legislators, search, filterState, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'score' ? 'desc' : 'asc');
    }
  }

  function sortArrow(field: SortField) {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  }

  if (sortedBills.length === 0) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        No vote data available for this session.
      </p>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="rounded-md border bg-background px-3 py-2 text-sm"
        />
        <select
          value={filterState}
          onChange={(e) => setFilterState(e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">All States</option>
          {states.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="self-center text-xs text-muted-foreground">
          {filtered.length} of {legislators.length} legislators
        </span>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-4 w-4 rounded border bg-green-100 text-center text-[10px] font-bold text-green-800">1</span>
          <span>Voted with RLC</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-4 w-4 rounded border bg-red-100 text-center text-[10px] font-bold text-red-800">0</span>
          <span>Voted against RLC</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-4 w-4 rounded border bg-gray-100 text-center text-[10px] text-gray-500">NV</span>
          <span>Not voting / Absent</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-4 w-4 rounded border bg-gray-50 text-center text-[10px] italic text-gray-400">NA</span>
          <span>Not applicable</span>
        </div>
      </div>

      {/* Matrix table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-max min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-10 min-w-[40px] border bg-muted/50 px-2 py-2 text-left font-medium">#</th>
                <th
                  className="sticky left-[40px] z-10 min-w-[160px] cursor-pointer border bg-muted/50 px-2 py-2 text-left font-medium hover:text-foreground"
                  onClick={() => toggleSort('name')}
                >
                  Legislator{sortArrow('name')}
                </th>
                <th
                  className="sticky left-[200px] z-10 min-w-[40px] cursor-pointer border bg-muted/50 px-2 py-2 text-left font-medium hover:text-foreground"
                  onClick={() => toggleSort('state')}
                >
                  St{sortArrow('state')}
                </th>
                {sortedBills.map((bill, i) => (
                  <th
                    key={bill.id}
                    className={`min-w-[36px] border px-1 py-2 text-center font-medium ${
                      bill.liberty_position === 'yea'
                        ? 'bg-green-50 dark:bg-green-950/30'
                        : 'bg-red-50 dark:bg-red-950/30'
                    }`}
                    title={`${bill.bill_number}: ${bill.title}`}
                  >
                    {i + 1}
                  </th>
                ))}
                <th className="min-w-[36px] border bg-muted/50 px-1 py-2 text-center font-medium" title="Votes with RLC">
                  W
                </th>
                <th className="min-w-[36px] border bg-muted/50 px-1 py-2 text-center font-medium" title="Percentage with RLC">
                  %
                </th>
                <th
                  className="min-w-[50px] cursor-pointer border bg-muted/50 px-1 py-2 text-center font-medium hover:text-foreground"
                  onClick={() => toggleSort('score')}
                  title="Liberty Score"
                >
                  Score{sortArrow('score')}
                </th>
              </tr>
              {/* Bill number sub-header */}
              <tr className="bg-muted/30">
                <th className="sticky left-0 z-10 border bg-muted/30 px-2 py-1" />
                <th className="sticky left-[40px] z-10 border bg-muted/30 px-2 py-1 text-left text-[10px] text-muted-foreground">
                  Bill #:
                </th>
                <th className="sticky left-[200px] z-10 border bg-muted/30 px-2 py-1" />
                {sortedBills.map((bill) => (
                  <th
                    key={bill.id}
                    className="border px-1 py-1 text-center text-[10px] font-normal text-muted-foreground"
                    title={bill.title}
                  >
                    {bill.bill_number.replace(/^(H\.?R\.?|S\.?|H\.?B\.?|S\.?B\.?)\s*/i, '')}
                  </th>
                ))}
                <th className="border px-1 py-1" />
                <th className="border px-1 py-1" />
                <th className="border px-1 py-1" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((leg, rowIdx) => {
                const legVotes = voteIndex.get(leg.id);
                const stats = legStats.get(leg.id);
                const pct = stats && stats.totalVoted > 0
                  ? Math.round((stats.withRlc / stats.totalVoted) * 100)
                  : null;

                return (
                  <tr key={leg.id} className="hover:bg-muted/20">
                    <td className="sticky left-0 z-10 border bg-card px-2 py-1 text-muted-foreground">
                      {rowIdx + 1}
                    </td>
                    <td className="sticky left-[40px] z-10 border bg-card px-2 py-1 font-medium">
                      <Link
                        href={`/scorecards/${scorecardSlug}/${leg.id}`}
                        className="text-rlc-blue hover:underline"
                      >
                        {leg.name}
                      </Link>
                    </td>
                    <td className="sticky left-[200px] z-10 border bg-card px-2 py-1 text-muted-foreground">
                      {leg.state_code}
                    </td>
                    {sortedBills.map((bill) => voteCell(legVotes?.get(bill.id)))}
                    <td className="border px-1 py-1 text-center font-medium">
                      {stats?.withRlc ?? '-'}
                    </td>
                    <td className="border px-1 py-1 text-center">
                      {pct !== null ? `${pct}` : '-'}
                    </td>
                    <td className={`border px-1 py-1 text-center font-bold ${scoreColor(leg.computed_score)}`}>
                      {leg.computed_score !== null ? Math.round(leg.computed_score) : '-'}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={sortedBills.length + 6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No legislators match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill key */}
      <div className="mt-4 rounded-lg border bg-muted/30 p-4">
        <h4 className="mb-2 text-sm font-medium">Bill Key</h4>
        <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {sortedBills.map((bill, i) => (
            <div key={bill.id} className="flex gap-2">
              <span className="font-medium text-muted-foreground">{i + 1}.</span>
              <span>
                <span className={`font-mono font-medium ${
                  bill.liberty_position === 'yea' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                }`}>
                  {bill.bill_number}
                </span>
                {' '}{bill.title.length > 60 ? bill.title.slice(0, 57) + '...' : bill.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
