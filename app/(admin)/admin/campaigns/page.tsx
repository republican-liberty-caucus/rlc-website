import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Plus } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Campaigns - Admin',
  description: 'Manage action campaigns',
};

interface CampaignRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  target_chamber: string | null;
  target_state_code: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export default async function AdminCampaignsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const supabase = createServerClient();

  let query = supabase
    .from('rlc_action_campaigns')
    .select('id, title, slug, status, target_chamber, target_state_code, starts_at, ends_at, created_at')
    .order('created_at', { ascending: false });

  if (ctx.visibleChapterIds !== null && ctx.visibleChapterIds.length > 0) {
    query = query.in('chapter_id', ctx.visibleChapterIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch campaigns: ${error.message}`);

  const campaigns = (data || []) as CampaignRow[];

  return (
    <div>
      <PageHeader
        title="Action Campaigns"
        count={campaigns.length}
        className="mb-8"
        action={
          <Link href="/admin/campaigns/new">
            <Button className="bg-rlc-red hover:bg-rlc-red/90">
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Button>
          </Link>
        }
      />

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Target</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Dates</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => {
                const chamberLabel = campaign.target_chamber
                  ? campaign.target_chamber.replace('us_', 'US ').replace('state_', 'State ').replace('house', 'House').replace('senate', 'Senate')
                  : 'All';
                const stateLabel = campaign.target_state_code || '';

                return (
                  <tr key={campaign.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-sm font-medium">{campaign.title}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {chamberLabel}{stateLabel ? ` (${stateLabel})` : ''}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={campaign.status} type="campaign" />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {campaign.starts_at ? formatDate(campaign.starts_at) : '-'}
                      {campaign.ends_at ? ` — ${formatDate(campaign.ends_at)}` : ''}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(campaign.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/campaigns/${campaign.id}`}>
                        <Button variant="outline" size="sm">Manage</Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No campaigns yet. Create one to start mobilizing members.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
