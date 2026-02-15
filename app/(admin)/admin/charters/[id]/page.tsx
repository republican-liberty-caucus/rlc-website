import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext, canManageRoles } from '@/lib/admin/permissions';
import { formatDate } from '@/lib/utils';
import { CharterDetailForm } from '@/components/admin/charter-detail-form';
import { CharterOfficersCard } from '@/components/admin/charter-officers-card';
import { ArrowLeft } from 'lucide-react';
import { logger } from '@/lib/logger';
import type { Charter, OfficerTitle } from '@/types';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data } = await supabase
    .from('rlc_charters')
    .select('name')
    .eq('id', id)
    .single();

  const charter = data as { name: string } | null;
  return {
    title: charter ? `${charter.name} - Admin` : 'Charter - Admin',
  };
}

export default async function AdminCharterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const { id } = await params;

  // Check charter visibility
  if (ctx.visibleCharterIds !== null && !ctx.visibleCharterIds.includes(id)) {
    redirect('/admin/charters?error=forbidden');
  }

  const supabase = createServerClient();

  // Fetch charter
  const { data: charterData, error: charterError } = await supabase
    .from('rlc_charters')
    .select('*')
    .eq('id', id)
    .single();

  if (charterError || !charterData) notFound();
  const charter = charterData as Charter;

  // Fetch sub-charters, member preview, parent, member count, and officers in parallel
  const [subChartersRes, membersRes, parentRes, memberCountRes, officersRes] = await Promise.all([
    supabase
      .from('rlc_charters')
      .select('id, name, status, state_code')
      .eq('parent_charter_id', id)
      .order('name'),
    supabase
      .from('rlc_contacts')
      .select('id, first_name, last_name, email, membership_status')
      .eq('primary_charter_id', id)
      .order('last_name')
      .limit(10),
    charter.parent_charter_id
      ? supabase
          .from('rlc_charters')
          .select('id, name')
          .eq('id', charter.parent_charter_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from('rlc_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('primary_charter_id', id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('rlc_organizational_positions')
      .select(`
        id, title, committee_name, started_at, ended_at, is_active, notes, created_at,
        member:rlc_contacts!rlc_organizational_positions_contact_id_fkey(id, first_name, last_name, email),
        appointed_by:rlc_contacts!rlc_organizational_positions_appointed_by_id_fkey(first_name, last_name)
      `)
      .eq('charter_id', id)
      .order('is_active', { ascending: false })
      .order('started_at', { ascending: false }),
  ]);

  if (subChartersRes.error) logger.error('Error fetching sub-charters:', subChartersRes.error);
  if (membersRes.error) logger.error('Error fetching charter members:', membersRes.error);
  if (memberCountRes.error) logger.error('Error fetching member count:', memberCountRes.error);
  if (officersRes.error) logger.error('Error fetching officers:', officersRes.error);

  const subCharters = (subChartersRes.data || []) as { id: string; name: string; status: string; state_code: string | null }[];
  const members = (membersRes.data || []) as { id: string; first_name: string; last_name: string; email: string; membership_status: string }[];
  const parentCharter = parentRes.data as { id: string; name: string } | null;
  const memberCount = memberCountRes.count;
  const officers = (officersRes.data || []) as {
    id: string;
    title: OfficerTitle;
    committee_name: string | null;
    started_at: string;
    ended_at: string | null;
    is_active: boolean;
    notes: string | null;
    member: { id: string; first_name: string; last_name: string; email: string } | null;
    appointed_by: { first_name: string; last_name: string } | null;
  }[];

  const showOfficerManagement = canManageRoles(ctx);

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    forming: 'bg-yellow-100 text-yellow-800',
  };

  const memberStatusColors: Record<string, string> = {
    current: 'bg-green-100 text-green-800',
    grace: 'bg-yellow-100 text-yellow-800',
    expired: 'bg-red-100 text-red-800',
    new_member: 'bg-blue-100 text-blue-800',
  };

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/charters"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Charters
        </Link>
      </div>

      <div className="mb-8">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{charter.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${statusColors[charter.status] || 'bg-gray-100'}`}>
              {charter.status}
            </span>
            <span className="text-sm capitalize text-muted-foreground">{charter.charter_level.replace(/_/g, ' ')}</span>
            {charter.state_code && (
              <span className="text-sm text-muted-foreground">{charter.state_code}</span>
            )}
          </div>
        </div>
      </div>

      {/* Onboarding Banner for forming charters */}
      {charter.status === 'forming' && (
        <div className="mb-8 rounded-lg border bg-yellow-50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-yellow-800">This charter is in the onboarding process</p>
            <p className="text-sm text-yellow-700">Complete the 8-step onboarding wizard to activate this charter.</p>
          </div>
          <Link
            href={`/admin/charters/${id}/onboarding`}
            className="rounded-md bg-rlc-red px-4 py-2 text-sm font-medium text-white hover:bg-rlc-red/90"
          >
            Continue Onboarding
          </Link>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Edit Form (2/3 width) */}
        <div className="lg:col-span-2">
          <CharterDetailForm charter={charter} />
        </div>

        {/* Right Column: Info Cards */}
        <div className="space-y-6">
          {/* Charter Info Card */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 font-semibold">Info</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Members</dt>
                <dd className="font-medium">{memberCount || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDate(charter.created_at)}</dd>
              </div>
              {parentCharter && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Parent</dt>
                  <dd>
                    <Link href={`/admin/charters/${parentCharter.id}`} className="text-rlc-red hover:underline">
                      {parentCharter.name}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Sub-Charters Card */}
          {subCharters.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 font-semibold">Sub-Charters ({subCharters.length})</h2>
              <ul className="space-y-2">
                {subCharters.map((sub) => (
                  <li key={sub.id} className="flex items-center justify-between text-sm">
                    <Link href={`/admin/charters/${sub.id}`} className="text-rlc-red hover:underline">
                      {sub.name}
                    </Link>
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusColors[sub.status] || 'bg-gray-100'}`}>
                      {sub.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Officers Card */}
          {showOfficerManagement && (
            <CharterOfficersCard
              charterId={id}
              officers={officers}
            />
          )}

          {/* Members Preview Card */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Members</h2>
              <Link href={`/admin/members?charter=${id}`} className="text-sm text-rlc-red hover:underline">
                View all
              </Link>
            </div>
            {members.length > 0 ? (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-sm">
                    <Link href={`/admin/members/${m.id}`} className="text-rlc-red hover:underline">
                      {m.first_name} {m.last_name}
                    </Link>
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${memberStatusColors[m.membership_status] || 'bg-gray-100'}`}>
                      {m.membership_status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No members in this charter</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
