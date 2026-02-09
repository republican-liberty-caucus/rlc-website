'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Search } from 'lucide-react';

export function MemberFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset to page 1 when filters change
      params.delete('page');
      startTransition(() => {
        router.push(`/admin/members?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        updateParam('search', e.currentTarget.value);
      }
    },
    [updateParam]
  );

  return (
    <div className="mb-6 flex flex-wrap gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search members... (press Enter)"
          defaultValue={searchParams.get('search') || ''}
          onKeyDown={handleSearchKeyDown}
          onBlur={(e) => updateParam('search', e.currentTarget.value)}
          className="w-full rounded-md border bg-background pl-10 pr-4 py-2 focus:border-rlc-red focus:outline-none focus:ring-1 focus:ring-rlc-red"
        />
      </div>
      <select
        defaultValue={searchParams.get('status') || ''}
        onChange={(e) => updateParam('status', e.target.value)}
        className="rounded-md border bg-background px-3 py-2"
      >
        <option value="">All Statuses</option>
        <option value="new_member">New</option>
        <option value="current">Current</option>
        <option value="grace">Grace</option>
        <option value="expired">Expired</option>
        <option value="pending">Pending</option>
        <option value="cancelled">Cancelled</option>
        <option value="expiring">Expiring</option>
      </select>
      <select
        defaultValue={searchParams.get('tier') || ''}
        onChange={(e) => updateParam('tier', e.target.value)}
        className="rounded-md border bg-background px-3 py-2"
      >
        <option value="">All Tiers</option>
        <option value="student_military">Student/Military</option>
        <option value="individual">Individual</option>
        <option value="premium">Premium</option>
        <option value="sustaining">Sustaining</option>
        <option value="patron">Patron</option>
        <option value="benefactor">Benefactor</option>
        <option value="roundtable">Roundtable</option>
      </select>
      <select
        defaultValue={searchParams.get('source') || ''}
        onChange={(e) => updateParam('source', e.target.value)}
        className="rounded-md border bg-background px-3 py-2"
      >
        <option value="">All Sources</option>
        <option value="highlevel_only">HighLevel Only</option>
        <option value="civicrm_only">CiviCRM Only</option>
        <option value="both">Both Sources</option>
      </select>
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground whitespace-nowrap">Joined:</label>
        <input
          type="date"
          defaultValue={searchParams.get('joined_after') || ''}
          onChange={(e) => updateParam('joined_after', e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
          title="Joined after"
        />
        <span className="text-sm text-muted-foreground">to</span>
        <input
          type="date"
          defaultValue={searchParams.get('joined_before') || ''}
          onChange={(e) => updateParam('joined_before', e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
          title="Joined before"
        />
      </div>
      {isPending && (
        <div className="flex items-center text-sm text-muted-foreground">
          Loading...
        </div>
      )}
    </div>
  );
}
