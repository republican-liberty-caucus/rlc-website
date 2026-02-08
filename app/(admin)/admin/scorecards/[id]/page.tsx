import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
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
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const { id } = await params;
  const supabase = createServerClient();

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
