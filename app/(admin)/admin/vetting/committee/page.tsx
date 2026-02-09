import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canManageCommittee } from '@/lib/vetting/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { CommitteeManager } from '@/components/admin/vetting/committee-manager';

export const metadata: Metadata = {
  title: 'Vetting Committee - Admin',
  description: 'Manage the candidate vetting committee',
};

interface CommitteeMemberRow {
  id: string;
  committee_id: string;
  contact_id: string;
  role: string;
  is_active: boolean;
  joined_at: string;
  contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

interface CommitteeRow {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export default async function VettingCommitteePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getVettingContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const supabase = createServerClient();
  const isManager = canManageCommittee(ctx);

  // Fetch committees
  const { data: committeeData } = await supabase
    .from('rlc_candidate_vetting_committees')
    .select('*')
    .order('created_at', { ascending: false });

  const committees = (committeeData || []) as CommitteeRow[];

  // Fetch members with contact info
  const committeeIds = committees.map((c) => c.id);
  let members: CommitteeMemberRow[] = [];

  if (committeeIds.length > 0) {
    const { data: memberData } = await supabase
      .from('rlc_candidate_vetting_committee_members')
      .select('*, contact:rlc_members(id, first_name, last_name, email)')
      .in('committee_id', committeeIds)
      .order('role', { ascending: true });

    members = (memberData || []) as CommitteeMemberRow[];
  }

  return (
    <div>
      <PageHeader
        title="Vetting Committee"
        count={members.filter((m) => m.is_active).length}
        className="mb-8"
      />

      <CommitteeManager
        committees={committees}
        members={members}
        canManage={isManager}
      />
    </div>
  );
}
