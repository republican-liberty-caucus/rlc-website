import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext, canManageRoles, canViewMember } from '@/lib/admin/permissions';
import { formatDate, formatCurrency } from '@/lib/utils';
import { MemberDetailForm } from '@/components/admin/member-detail-form';
import { MemberRolesCard } from '@/components/admin/member-roles-card';
import { MemberPositionsCard } from '@/components/admin/member-positions-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Shield, CreditCard as CreditCardIcon, Users, Calendar } from 'lucide-react';
import { logger } from '@/lib/logger';
import type { Member, Chapter, Contribution, OfficerTitle } from '@/types';
import type { AdminRole } from '@/lib/admin/permissions';

interface MemberRoleRow extends AdminRole {
  chapter: { name: string } | null;
  granter: { first_name: string; last_name: string } | null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data } = await supabase
    .from('rlc_members')
    .select('first_name, last_name')
    .eq('id', id)
    .single();

  const member = data as { first_name: string; last_name: string } | null;
  return {
    title: member ? `${member.first_name} ${member.last_name} - Admin` : 'Member - Admin',
  };
}

export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const { id } = await params;
  const supabase = createServerClient();

  // Fetch member
  const { data: memberData, error: memberError } = await supabase
    .from('rlc_members')
    .select('*')
    .eq('id', id)
    .single();

  if (memberError || !memberData) notFound();
  const member = memberData as Member;

  // Check chapter visibility
  if (!canViewMember(ctx, member.primary_chapter_id)) {
    redirect('/admin/members?error=forbidden');
  }

  // Fetch chapters, contributions, memberships, roles, household, and positions in parallel
  const [chaptersRes, contributionsRes, membershipsRes, rolesRes, householdRes, positionsRes] = await Promise.all([
    (ctx.visibleChapterIds !== null
      ? supabase.from('rlc_chapters').select('id, name').in('id', ctx.visibleChapterIds).order('name')
      : supabase.from('rlc_chapters').select('id, name').order('name')
    ),
    supabase
      .from('rlc_contributions')
      .select('*')
      .eq('member_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('rlc_memberships')
      .select('*')
      .eq('contact_id', id)
      .order('join_date', { ascending: false }),
    supabase
      .from('rlc_member_roles')
      .select(`
        id, role, chapter_id, granted_by, granted_at, expires_at,
        chapter:rlc_chapters(name),
        granter:rlc_members!rlc_member_roles_granted_by_fkey(first_name, last_name)
      `)
      .eq('member_id', id),
    member.household_id
      ? supabase
          .from('rlc_members')
          .select('id, first_name, last_name, email, household_role')
          .eq('household_id', member.household_id)
          .neq('id', id)
      : Promise.resolve({ data: [] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('rlc_officer_positions')
      .select(`
        id, title, committee_name, started_at, ended_at, is_active, notes, created_at,
        chapter:rlc_chapters(id, name),
        appointed_by:rlc_members!rlc_officer_positions_appointed_by_id_fkey(first_name, last_name)
      `)
      .eq('member_id', id)
      .order('is_active', { ascending: false })
      .order('started_at', { ascending: false }),
  ]);

  if (chaptersRes.error) logger.error('Error fetching chapters:', chaptersRes.error);
  if (contributionsRes.error) logger.error('Error fetching contributions:', contributionsRes.error);
  if (membershipsRes.error) logger.error('Error fetching memberships:', membershipsRes.error);
  if (rolesRes.error) logger.error('Error fetching member roles:', rolesRes.error);
  if (positionsRes.error) logger.error('Error fetching member positions:', positionsRes.error);

  const chapters = (chaptersRes.data || []) as Pick<Chapter, 'id' | 'name'>[];
  const contributions = (contributionsRes.data || []) as Contribution[];
  const memberships = (membershipsRes.data || []) as {
    id: string;
    membership_tier: string;
    membership_status: string;
    join_date: string | null;
    start_date: string | null;
    expiry_date: string | null;
    is_auto_renew: boolean;
  }[];
  const memberRoles = (rolesRes.data || []) as MemberRoleRow[];
  const householdMembers = (householdRes.data || []) as {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    household_role: string | null;
  }[];
  const memberPositions = (positionsRes.data || []) as {
    id: string;
    title: OfficerTitle;
    committee_name: string | null;
    started_at: string;
    ended_at: string | null;
    is_active: boolean;
    chapter: { id: string; name: string } | null;
    appointed_by: { first_name: string; last_name: string } | null;
  }[];

  const showRoleManagement = canManageRoles(ctx);

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/members"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Members
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          {member.first_name} {member.last_name}
        </h1>
        <p className="mt-1 text-muted-foreground">{member.email}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Edit Form (2/3 width) */}
        <div className="lg:col-span-2">
          <MemberDetailForm member={member} chapters={chapters} isNational={ctx.isNational} />
        </div>

        {/* Right Column: Info Cards (1/3 width) */}
        <div className="space-y-6">
          {/* Membership Info Card */}
          <Card>
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-rlc-red" />
                <h2 className="font-heading font-semibold">Membership Info</h2>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <StatusBadge status={member.membership_status} type="membership" />
                <span className="text-sm capitalize text-muted-foreground">{member.membership_tier}</span>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Member Since</dt>
                  <dd>{member.membership_join_date ? formatDate(member.membership_join_date) : formatDate(member.created_at)}</dd>
                </div>
                {member.membership_start_date && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Period Start</dt>
                    <dd>{formatDate(member.membership_start_date)}</dd>
                  </div>
                )}
                {member.membership_expiry_date && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Expiry Date</dt>
                    <dd>{formatDate(member.membership_expiry_date)}</dd>
                  </div>
                )}
                {member.stripe_customer_id && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Stripe ID</dt>
                    <dd className="font-mono text-xs">{member.stripe_customer_id}</dd>
                  </div>
                )}
                {member.highlevel_contact_id && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">HighLevel ID</dt>
                    <dd className="font-mono text-xs">{member.highlevel_contact_id}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Membership History Card */}
          {memberships.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-rlc-red" />
                  <h2 className="font-heading font-semibold">Membership History</h2>
                </div>
                <div className="space-y-3">
                  {memberships.map((m) => (
                    <div key={m.id} className="border-l-2 border-rlc-red/20 pl-3">
                      <div className="flex items-center justify-between">
                        <StatusBadge status={m.membership_status} type="membership" />
                        <span className="text-xs capitalize text-muted-foreground">{m.membership_tier}</span>
                      </div>
                      <dl className="mt-2 space-y-1 text-xs">
                        {m.join_date && (
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Joined</dt>
                            <dd>{formatDate(m.join_date)}</dd>
                          </div>
                        )}
                        {m.start_date && (
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Started</dt>
                            <dd>{formatDate(m.start_date)}</dd>
                          </div>
                        )}
                        {m.expiry_date && (
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Expires</dt>
                            <dd>{formatDate(m.expiry_date)}</dd>
                          </div>
                        )}
                        {m.is_auto_renew && (
                          <div className="text-xs text-green-600">Auto-renew enabled</div>
                        )}
                      </dl>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Household Card */}
          {householdMembers.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-rlc-blue" />
                  <h2 className="font-heading font-semibold">Household</h2>
                </div>
                <ul className="space-y-2">
                  {householdMembers.map((hm) => (
                    <li key={hm.id} className="flex items-center justify-between text-sm">
                      <Link href={`/admin/members/${hm.id}`} className="text-rlc-red hover:underline">
                        {hm.first_name} {hm.last_name}
                      </Link>
                      <span className="capitalize text-muted-foreground">{hm.household_role}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Contributions Card */}
          <Card>
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <CreditCardIcon className="h-5 w-5 text-green-600" />
                <h2 className="font-heading font-semibold">Recent Contributions</h2>
              </div>
              {contributions.length > 0 ? (
                <ul className="space-y-2">
                  {contributions.map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="capitalize">{c.contribution_type.replace(/_/g, ' ')}</span>
                        <span className="ml-2 text-muted-foreground">{formatDate(c.created_at)}</span>
                      </div>
                      <span className="font-medium text-green-600">
                        {formatCurrency(Number(c.amount))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No contributions</p>
              )}
            </CardContent>
          </Card>

          {/* Officer Positions Card */}
          <MemberPositionsCard positions={memberPositions} />

          {/* Roles Card */}
          {showRoleManagement ? (
            <MemberRolesCard
              memberId={member.id}
              roles={memberRoles}
              chapters={chapters}
            />
          ) : (
            memberRoles.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-purple-600" />
                    <h2 className="font-heading font-semibold">Roles</h2>
                  </div>
                  <ul className="space-y-2">
                    {memberRoles.map((r) => (
                      <li key={r.id} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{r.role.replace(/_/g, ' ')}</span>
                        <span className="text-muted-foreground">{r.chapter?.name || 'National'}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </div>
    </div>
  );
}
