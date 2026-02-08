import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { CampaignManagement } from '@/components/admin/campaign-management';
import type { ActionCampaign } from '@/types';

export const metadata: Metadata = {
  title: 'Manage Campaign - Admin',
  description: 'Manage action campaign details and participation',
};

export default async function CampaignDetailPage({
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

  const { data: campaign, error } = await supabase
    .from('rlc_action_campaigns')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !campaign) {
    redirect('/admin/campaigns');
  }

  // Fetch participation count
  const { count: participationCount } = await supabase
    .from('rlc_campaign_participations')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', id);

  return (
    <div>
      <CampaignManagement
        campaign={campaign as ActionCampaign}
        participationCount={participationCount || 0}
      />
    </div>
  );
}
