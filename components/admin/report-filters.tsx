'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { CharterOption } from '@/lib/admin/report-helpers';

interface ReportFiltersProps {
  charters?: CharterOption[];
  isNational: boolean;
}

export function ReportFilters({ charters, isNational }: ReportFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const [startDate, setStartDate] = React.useState(
    searchParams.get('start') || ''
  );
  const [endDate, setEndDate] = React.useState(
    searchParams.get('end') || ''
  );

  const navigateWithParams = React.useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(overrides)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      startTransition(() => {
        router.push(`/admin/reports?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const setPreset = React.useCallback(
    (days: number) => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      setStartDate(startStr);
      setEndDate(endStr);
      navigateWithParams({ start: startStr, end: endStr });
    },
    [navigateWithParams]
  );

  const applyCustomDates = React.useCallback(() => {
    navigateWithParams({ start: startDate, end: endDate });
  }, [navigateWithParams, startDate, endDate]);

  const handleCharterChange = React.useCallback(
    (charterId: string) => {
      navigateWithParams({ charter: charterId });
    },
    [navigateWithParams]
  );

  // Build export URL with current params
  const exportParams = new URLSearchParams();
  if (startDate) exportParams.set('start', startDate);
  if (endDate) exportParams.set('end', endDate);
  const currentCharter = searchParams.get('charter') || '';
  if (currentCharter) exportParams.set('charter', currentCharter);

  return (
    <div className="mb-8 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
        {/* Charter dropdown (multi-charter users only) */}
        {charters && charters.length > 1 && (
          <div>
            <label className="mb-1 block text-sm font-medium">Charter</label>
            <select
              value={currentCharter}
              onChange={(e) => handleCharterChange(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm sm:w-auto"
            >
              <option value="">
                {isNational ? 'All Charters' : 'All My Charters'}
              </option>
              {charters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {'\u00A0'.repeat(ch.indent * 2)}{ch.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreset(30)}>
            30 days
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPreset(90)}>
            90 days
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPreset(365)}>
            1 year
          </Button>
        </div>
        <Button size="sm" onClick={applyCustomDates}>
          Apply
        </Button>
        <div className="flex items-center gap-2 sm:ml-auto">
          {isPending && (
            <span className="text-sm text-muted-foreground">Loading...</span>
          )}
          <a href={`/api/v1/admin/reports/export?${exportParams.toString()}`}>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
