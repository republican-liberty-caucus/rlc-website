import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/route-helpers';
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
  const { supabase } = await requireAdmin();

  const { id } = await params;

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
