'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export function ReportFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [startDate, setStartDate] = React.useState(
    searchParams.get('start') || ''
  );
  const [endDate, setEndDate] = React.useState(
    searchParams.get('end') || ''
  );

  function applyFilters() {
    const params = new URLSearchParams();
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    router.push(`/admin/reports?${params.toString()}`);
  }

  function setPreset(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }

  return (
    <div className="mb-8 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
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
        <Button size="sm" onClick={applyFilters}>
          Apply
        </Button>
        <a
          href={`/api/v1/admin/reports/export?${new URLSearchParams({ start: startDate, end: endDate }).toString()}`}
          className="sm:ml-auto"
        >
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </a>
      </div>
    </div>
  );
}
