import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/route-helpers';
import { ScorecardManagement } from '@/components/admin/scorecard-management';

export const metadata: Metadata = {
  title: 'Manage Scorecard - Admin',
  description: 'Manage scorecard session bills, votes, and scores',
};

export default async function ScorecardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireAdmin();

  const { id } = await params;

  const { data: session, error } = await supabase
    .from('rlc_scorecard_sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !session) {
    redirect('/admin/scorecards');
  }

  return (
    <div>
      <ScorecardManagement session={session} />
    </div>
  );
}
