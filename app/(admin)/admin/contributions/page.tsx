import { Metadata } from 'next';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin/route-helpers';
import { formatDate, formatCurrency } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';

export const metadata: Metadata = {
  title: 'Contributions - Admin',
  description: 'View all RLC contributions',
};

interface SearchParams {
  page?: string;
  status?: string;
}

interface ContributionRow {
  id: string;
  amount: number;
  currency: string;
  payment_status: string;
  contribution_type: string;
  created_at: string;
  civicrm_contribution_id: number | null;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

async function getContributions(searchParams: SearchParams) {
  const supabase = createServerClient();
  const page = parseInt(searchParams.page || '1', 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('rlc_contributions')
    .select(`
      id, amount, currency, payment_status, contribution_type,
      created_at, civicrm_contribution_id,
      member:rlc_contacts!contact_id(id, first_name, last_name, email)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (searchParams.status) {
    query = query.eq('payment_status', searchParams.status);
  }

  const { data, count, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch contributions: ${error.message}`);
  }

  const contributions = (data || []) as ContributionRow[];

  return {
    contributions,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

function buildPageUrl(params: SearchParams, page: number): string {
  const sp = new URLSearchParams();
  sp.set('page', String(page));
  if (params.status) sp.set('status', params.status);
  return `/admin/contributions?${sp.toString()}`;
}

export default async function AdminContributionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const { contributions, total, page, totalPages } = await getContributions(params);

  // Calculate totals
  const totalAmount = contributions.reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <div>
      <PageHeader
        title="Contributions"
        count={total}
        className="mb-8"
      />

      {/* Summary Stats */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Contributions</div>
          <div className="text-2xl font-bold">{total.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Amount (this page)</div>
          <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">From CiviCRM</div>
          <div className="text-2xl font-bold">
            {contributions.filter(c => c.civicrm_contribution_id).length}
          </div>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="mb-4 flex gap-2">
        <Link
          href="/admin/contributions"
          className={`rounded-md px-3 py-2 text-sm ${
            !params.status
              ? 'bg-rlc-red text-white'
              : 'border hover:bg-muted'
          }`}
        >
          All
        </Link>
        <Link
          href="/admin/contributions?status=completed"
          className={`rounded-md px-3 py-2 text-sm ${
            params.status === 'completed'
              ? 'bg-rlc-red text-white'
              : 'border hover:bg-muted'
          }`}
        >
          Completed
        </Link>
        <Link
          href="/admin/contributions?status=pending"
          className={`rounded-md px-3 py-2 text-sm ${
            params.status === 'pending'
              ? 'bg-rlc-red text-white'
              : 'border hover:bg-muted'
          }`}
        >
          Pending
        </Link>
      </div>

      {/* Contributions Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Member</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((contribution) => (
                <tr key={contribution.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm">
                    {formatDate(contribution.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {contribution.member ? (
                      <Link
                        href={`/admin/members/${contribution.member.id}`}
                        className="hover:underline"
                      >
                        <div className="font-medium">
                          {contribution.member.first_name} {contribution.member.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {contribution.member.email}
                        </div>
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">No member</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm capitalize">
                    {contribution.contribution_type.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {formatCurrency(contribution.amount, contribution.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={contribution.payment_status} type="payment" />
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {contribution.civicrm_contribution_id
                      ? `CiviCRM #${contribution.civicrm_contribution_id}`
                      : 'New system'}
                  </td>
                </tr>
              ))}
              {contributions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No contributions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={buildPageUrl(params, page - 1)}
                  className="rounded border px-3 py-1 text-sm hover:bg-muted"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildPageUrl(params, page + 1)}
                  className="rounded border px-3 py-1 text-sm hover:bg-muted"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
