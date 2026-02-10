'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SessionSummary {
  slug: string;
  session_year: number;
  chamber: string | null;
}

interface ScorecardSwitcherProps {
  currentSlug: string;
  sessions: SessionSummary[];
}

const CHAMBER_LABELS: Record<string, string> = {
  us_house: 'U.S. House',
  us_senate: 'U.S. Senate',
  state_house: 'State House',
  state_senate: 'State Senate',
};

export function ScorecardSwitcher({ currentSlug, sessions }: ScorecardSwitcherProps) {
  const router = useRouter();

  const current = sessions.find((s) => s.slug === currentSlug);
  const [selectedYear, setSelectedYear] = useState<number>(current?.session_year ?? 0);

  const years = useMemo(() => {
    const set = new Set(sessions.map((s) => s.session_year));
    return Array.from(set).sort((a, b) => b - a);
  }, [sessions]);

  const chambersForYear = useMemo(() => {
    return sessions.filter((s) => s.session_year === selectedYear);
  }, [sessions, selectedYear]);

  const currentChamber = current?.chamber ?? chambersForYear[0]?.chamber ?? null;

  function handleYearChange(year: string) {
    const y = Number(year);
    setSelectedYear(y);
    const match = sessions.find((s) => s.session_year === y && s.chamber === currentChamber)
      ?? sessions.find((s) => s.session_year === y);
    if (match && match.slug !== currentSlug) {
      router.push(`/scorecards/${match.slug}`);
    }
  }

  function handleChamberChange(chamber: string) {
    const match = sessions.find((s) => s.session_year === selectedYear && s.chamber === chamber);
    if (match && match.slug !== currentSlug) {
      router.push(`/scorecards/${match.slug}`);
    }
  }

  if (sessions.length <= 1) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-widest text-white/50">Browse Scorecards</p>
      <div className="flex items-center gap-2">
        <Select value={String(selectedYear)} onValueChange={handleYearChange}>
          <SelectTrigger className="h-9 w-[100px] border-white/20 bg-white/10 text-sm text-white hover:bg-white/20 focus:ring-white/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentChamber ?? ''}
          onValueChange={handleChamberChange}
          disabled={chambersForYear.length <= 1}
        >
          <SelectTrigger className="h-9 w-[150px] border-white/20 bg-white/10 text-sm text-white hover:bg-white/20 focus:ring-white/30 disabled:opacity-50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {chambersForYear.map((s) => (
              <SelectItem key={s.chamber} value={s.chamber ?? ''}>
                {CHAMBER_LABELS[s.chamber ?? ''] ?? s.chamber}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
