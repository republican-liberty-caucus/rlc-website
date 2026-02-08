import { Metadata } from 'next';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Search, Download, Filter } from 'lucide-react';
import { MembershipTier, MembershipStatus } from '@/types';

export const metadata: Metadata = {
  title: 'Members - Admin',
  description: 'Manage RLC members',
};

interface SearchParams {
  page?: string;
  search?: string;
  status?: string;
  tier?: string;
}

interface MemberRow {
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
  created_at: string;
  primary_chapter: { name: string } | null;
}

async function getMembers(searchParams: SearchParams) {
  const supabase = createServerClient();
  const page = parseInt(searchParams.page || '1', 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('rlc_members')
    .select(`
      id, email, first_name, last_name, phone,
      city, state, membership_tier, membership_status,
      membership_expiry_date, created_at,
      primary_chapter:rlc_chapters(name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (searchParams.search) {
    query = query.or(`email.ilike.%${searchParams.search}%,first_name.ilike.%${searchParams.search}%,last_name.ilike.%${searchParams.search}%`);
  }

  if (searchParams.status) {
    query = query.eq('membership_status', searchParams.status);
  }

  if (searchParams.tier) {
    query = query.eq('membership_tier', searchParams.tier);
  }

  const { data, count } = await query;
  const members = (data || []) as MemberRow[];

  return {
    members,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { members, total, page, totalPages } = await getMembers(params);

  const statusColors: Record<string, string> = {
    new_member: 'bg-blue-100 text-blue-800',
    current: 'bg-green-100 text-green-800',
    grace: 'bg-yellow-100 text-yellow-800',
    expired: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
    cancelled: 'bg-gray-100 text-gray-800',
    deceased: 'bg-gray-100 text-gray-800',
    expiring: 'bg-orange-100 text-orange-800',
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Members</h1>
          <p className="mt-2 text-muted-foreground">
            {total.toLocaleString()} total members
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button className="bg-rlc-red hover:bg-rlc-red/90">
            Add Member
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search members..."
            defaultValue={params.search}
            className="w-full rounded-md border bg-background pl-10 pr-4 py-2 focus:border-rlc-red focus:outline-none focus:ring-1 focus:ring-rlc-red"
          />
        </div>
        <select
          defaultValue={params.status || ''}
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
          defaultValue={params.tier || ''}
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
      </div>

      {/* Members Table */}
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Chapter</th>
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
                    {member.primary_chapter?.name || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm capitalize">{member.membership_tier}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${
                        statusColors[member.membership_status] || 'bg-gray-100'
                      }`}
                    >
                      {member.membership_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{formatDate(member.created_at)}</td>
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
                  href={`/admin/members?page=${page - 1}${params.search ? `&search=${params.search}` : ''}${params.status ? `&status=${params.status}` : ''}${params.tier ? `&tier=${params.tier}` : ''}`}
                  className="rounded border px-3 py-1 text-sm hover:bg-muted"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/members?page=${page + 1}${params.search ? `&search=${params.search}` : ''}${params.status ? `&status=${params.status}` : ''}${params.tier ? `&tier=${params.tier}` : ''}`}
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
