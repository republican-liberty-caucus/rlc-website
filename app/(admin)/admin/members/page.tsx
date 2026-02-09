import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext, applyMemberFilters } from '@/lib/admin/permissions';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Download } from 'lucide-react';
import { MemberFilters } from '@/components/admin/member-filters';
import type { MembershipTier, MembershipStatus } from '@/types';

export const metadata: Metadata = {
  title: 'Members - Admin',
  description: 'Manage RLC members',
};

interface SearchParams {
  page?: string;
  search?: string;
  status?: string;
  tier?: string;
  source?: string;
  joined_after?: string;
  joined_before?: string;
}

interface ContactRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  membership_tier: MembershipTier;
  membership_status: MembershipStatus;
  membership_expiry_date: string | null;
  membership_join_date: string | null;
  created_at: string;
  primary_charter: { name: string } | null;
}

async function getMembers(
  searchParams: SearchParams,
  visibleCharterIds: string[] | null
) {
  const supabase = createServerClient();
  const page = parseInt(searchParams.page || '1', 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('rlc_members')
    .select(`
      id, email, first_name, last_name, phone,
      city, state, membership_tier, membership_status,
      membership_expiry_date, membership_join_date, created_at,
      primary_charter:rlc_charters(name)
    `, { count: 'exact' })
    .order('membership_join_date', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  query = applyMemberFilters(query, visibleCharterIds, searchParams);

  const { data, count, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch members: ${error.message}`);
  }
  const members = (data || []) as ContactRow[];

  return {
    members,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

function buildFilterParams(params: SearchParams, page?: number): URLSearchParams {
  const sp = new URLSearchParams();
  if (page) sp.set('page', String(page));
  if (params.search) sp.set('search', params.search);
  if (params.status) sp.set('status', params.status);
  if (params.tier) sp.set('tier', params.tier);
  if (params.source) sp.set('source', params.source);
  if (params.joined_after) sp.set('joined_after', params.joined_after);
  if (params.joined_before) sp.set('joined_before', params.joined_before);
  return sp;
}

function buildPageUrl(params: SearchParams, page: number): string {
  return `/admin/members?${buildFilterParams(params, page).toString()}`;
}

function buildExportUrl(params: SearchParams): string {
  return `/api/v1/admin/members/export?${buildFilterParams(params).toString()}`;
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const params = await searchParams;
  const { members, total, page, totalPages } = await getMembers(
    params,
    ctx.visibleCharterIds
  );

  return (
    <div>
      <PageHeader
        title="Members"
        count={total}
        className="mb-8"
        action={
          <a href={buildExportUrl(params)}>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </a>
        }
      />

      {/* Filters */}
      <MemberFilters />

      {/* Members Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Charter</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Tier</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Joined</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {member.first_name} {member.last_name}
                    </div>
                    {member.city && member.state && (
                      <div className="text-sm text-muted-foreground">
                        {member.city}, {member.state}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{member.email}</td>
                  <td className="px-4 py-3 text-sm">
                    {member.primary_charter?.name || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm capitalize">{member.membership_tier}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={member.membership_status} type="membership" />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {member.membership_join_date
                      ? formatDate(member.membership_join_date)
                      : formatDate(member.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/members/${member.id}`}
                      className="text-sm text-rlc-red hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No members found.
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
