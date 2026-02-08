'use client';

import { Briefcase } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { OFFICER_TITLE_LABELS } from '@/lib/validations/officer-position';
import { formatDate } from '@/lib/utils';
import type { OfficerTitle } from '@/types';

interface PositionRow {
  id: string;
  title: OfficerTitle;
  committee_name: string | null;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
  chapter: { id: string; name: string } | null;
  appointed_by: { first_name: string; last_name: string } | null;
}

interface MemberPositionsCardProps {
  positions: PositionRow[];
}

export function MemberPositionsCard({ positions }: MemberPositionsCardProps) {
  if (positions.length === 0) return null;

  const active = positions.filter((p) => p.is_active);
  const past = positions.filter((p) => !p.is_active);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-rlc-blue" />
          <h2 className="font-heading font-semibold">Officer Positions</h2>
        </div>

        {active.length > 0 && (
          <ul className="space-y-2">
            {active.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">
                    {OFFICER_TITLE_LABELS[p.title]}
                    {p.committee_name && ` — ${p.committee_name}`}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {p.chapter?.name || 'National'} · Since {formatDate(p.started_at)}
                  </p>
                </div>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Active</span>
              </li>
            ))}
          </ul>
        )}

        {past.length > 0 && (
          <div className={active.length > 0 ? 'mt-3 pt-3 border-t' : ''}>
            <p className="text-xs font-medium text-muted-foreground mb-2">Past</p>
            <ul className="space-y-1">
              {past.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {OFFICER_TITLE_LABELS[p.title]} — {p.chapter?.name || 'National'}
                  </span>
                  <span>{p.ended_at ? formatDate(p.ended_at) : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
