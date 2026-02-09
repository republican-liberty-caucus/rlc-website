import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { createServerClient, getMemberByClerkId } from '@/lib/supabase/server';
import { AddressLookup } from '@/components/action-center/address-lookup';
import { CampaignProgress } from '@/components/action-center/campaign-progress';
import { MemberContextBadge } from '@/components/shared/member-context-badge';
import { EmptyState } from '@/components/ui/empty-state';
import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import type { ActionCampaign } from '@/types';

export const metadata: Metadata = {
  title: 'Action Center',
  description: 'Make your voice heard. Contact your representatives and take action on liberty issues.',
};

export default async function ActionCenterPage() {
  const supabase = createServerClient();

  // Fetch campaigns with participation counts
  const { data } = await supabase
    .from('rlc_action_campaigns')
    .select('id, title, slug, description, status')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(6);

  const campaigns = (data || []) as Pick<ActionCampaign, 'id' | 'title' | 'slug' | 'description' | 'status'>[];

  // Get participation counts for each campaign
  const campaignsWithCounts = await Promise.all(
    campaigns.map(async (campaign) => {
      const { count, error } = await supabase
        .from('rlc_campaign_participations')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);
      if (error) console.error(`[action-center] participation count for ${campaign.id}:`, error.message);
      return { ...campaign, participation_count: count || 0 };
    })
  );

  // Check if logged-in member has participated in any campaigns
  let memberParticipations = new Set<string>();
  const { userId } = await auth();
  if (userId) {
    const member = await getMemberByClerkId(userId);
    if (member) {
      const { data: participations } = await supabase
        .from('rlc_campaign_participations')
        .select('campaign_id')
        .eq('contact_id', member.id);
      memberParticipations = new Set((participations || []).map((p: { campaign_id: string }) => p.campaign_id));
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <section className="bg-gradient-to-br from-rlc-red to-rlc-red/80 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-heading text-4xl font-bold">Make Your Voice Heard</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-white/90">
            Contact your elected officials and let them know where you stand on the issues that matter.
          </p>
        </div>
      </section>

      {/* Address Lookup */}
      <section className="bg-muted/30 py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-4 text-center font-heading text-2xl font-bold">Find Your Representatives</h2>
            <p className="mb-6 text-center text-muted-foreground">
              Enter your address to find your elected officials and their contact information.
            </p>
            <AddressLookup />
          </div>
        </div>
      </section>

      {/* Active Campaigns */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-6 font-heading text-2xl font-bold">Active Campaigns</h2>
          {campaignsWithCounts.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {campaignsWithCounts.map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/action-center/contact?campaign=${campaign.slug}`}
                  className="group rounded-lg border bg-card p-6 transition-all hover:border-rlc-red hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      Active
                    </span>
                    {memberParticipations.has(campaign.id) && (
                      <MemberContextBadge label="You took action" variant="participated" />
                    )}
                  </div>
                  <h3 className="mt-2 font-heading text-lg font-semibold group-hover:text-rlc-red">
                    {campaign.title}
                  </h3>
                  {campaign.description && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {campaign.description}
                    </p>
                  )}
                  <CampaignProgress participationCount={campaign.participation_count} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Megaphone className="h-10 w-10" />}
              title="No Active Campaigns"
              description="Check back soon for new opportunities to make your voice heard."
              action={{ label: 'Find Your Reps', href: '/action-center/contact' }}
            />
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
