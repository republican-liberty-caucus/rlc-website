import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canManageDeadlines } from '@/lib/vetting/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { DeadlineManager } from '@/components/admin/vetting/deadline-manager';

export const metadata: Metadata = {
  title: 'Election Deadlines - Admin',
  description: 'Manage election deadlines by state',
};

interface DeadlineRow {
  id: string;
  state_code: string;
  cycle_year: number;
  office_type: string;
  primary_date: string | null;
  primary_runoff_date: string | null;
  general_date: string | null;
  general_runoff_date: string | null;
  filing_deadline: string | null;
  notes: string | null;
  created_at: string;
}

export default async function VettingDeadlinesPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getVettingContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const isManager = canManageDeadlines(ctx);
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('rlc_candidate_election_deadlines')
    .select('*')
    .order('state_code', { ascending: true })
    .order('cycle_year', { ascending: false });

  if (error) throw new Error(`Failed to fetch deadlines: ${error.message}`);

  const deadlines = (data || []) as DeadlineRow[];

  return (
    <div>
      <PageHeader
        title="Election Deadlines"
        count={deadlines.length}
        className="mb-8"
      />

      <DeadlineManager deadlines={deadlines} canManage={isManager} />
    </div>
  );
}
