import Link from 'next/link';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { HeroSection } from '@/components/home/hero-section';
import { UrgencyBar } from '@/components/home/urgency-bar';
import { ActivityFeed } from '@/components/home/activity-feed';
import { ScorecardSpotlight } from '@/components/home/scorecard-spotlight';
import { CampaignGrid } from '@/components/home/campaign-grid';
import { StatsBar } from '@/components/home/stats-bar';
import { EventPreview } from '@/components/home/event-preview';
import { createServerClient } from '@/lib/supabase/server';

async function getHomePageData() {
  const supabase = createServerClient();

  const [
    membersResult,
    chaptersResult,
    campaignsResult,
    campaignCountResult,
    eventsResult,
    postsResult,
    scorecardResult,
  ] = await Promise.all([
    // Active member count + distinct states
    supabase
      .from('rlc_members')
      .select('state', { count: 'exact', head: false })
      .in('membership_status', ['current', 'new_member', 'grace']),

    // Chapter count
    supabase
      .from('rlc_chapters')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),

    // Active campaigns with participation counts
    supabase
      .from('rlc_action_campaigns')
      .select('id, title, slug, description, status')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(3),

    // Total active campaign count (for urgency bar)
    supabase
      .from('rlc_action_campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),

    // Next 3 upcoming events
    supabase
      .from('rlc_events')
      .select('id, title, slug, start_date, is_virtual, city, state')
      .eq('status', 'published')
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })
      .limit(3),

    // Latest 3 blog posts (exclude WordPress "Pages" category)
    supabase
      .from('rlc_posts')
      .select('id, title, slug, excerpt, published_at')
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .not('categories', 'cs', '{"Pages"}')
      .order('published_at', { ascending: false })
      .limit(3),

    // Latest published scorecard session
    supabase
      .from('rlc_scorecard_sessions')
      .select('id, name, slug')
      .eq('status', 'published')
      .order('session_year', { ascending: false })
      .limit(1)
      .single(),
  ]);

  // Log any Supabase query errors (non-fatal — we fall back to empty data)
  if (membersResult.error) console.error('[homepage] members query:', membersResult.error.message);
  if (chaptersResult.error) console.error('[homepage] chapters query:', chaptersResult.error.message);
  if (campaignsResult.error) console.error('[homepage] campaigns query:', campaignsResult.error.message);
  if (campaignCountResult.error) console.error('[homepage] campaign count query:', campaignCountResult.error.message);
  if (eventsResult.error) console.error('[homepage] events query:', eventsResult.error.message);
  if (postsResult.error) console.error('[homepage] posts query:', postsResult.error.message);
  // scorecardResult.error is expected when no published sessions exist (PGRST116)

  // Get distinct states from members
  const memberRows = (membersResult.data || []) as Array<{ state: string | null }>;
  const distinctStates = new Set(memberRows.map((m) => m.state).filter(Boolean));

  // Get participation counts for campaigns
  const campaigns = (campaignsResult.data || []) as Array<{
    id: string;
    title: string;
    slug: string;
    description: string | null;
    status: string;
  }>;

  const campaignsWithCounts = await Promise.all(
    campaigns.map(async (campaign) => {
      const { count } = await supabase
        .from('rlc_campaign_participations')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);
      return { ...campaign, participation_count: count || 0 };
    })
  );

  // Get top/bottom legislators for scorecard spotlight
  let champions: Array<{
    id: string;
    name: string;
    party: string;
    state_code: string;
    current_score: number | null;
  }> = [];
  let worstOffenders: typeof champions = [];
  let sessionName = '';
  let sessionSlug = '';

  const scorecardData = scorecardResult.data as { id: string; name: string; slug: string } | null;
  if (scorecardData) {
    sessionName = scorecardData.name;
    sessionSlug = scorecardData.slug;

    const [topResult, bottomResult] = await Promise.all([
      supabase
        .from('rlc_legislators')
        .select('id, name, party, state_code, current_score')
        .not('current_score', 'is', null)
        .order('current_score', { ascending: false })
        .limit(3),
      supabase
        .from('rlc_legislators')
        .select('id, name, party, state_code, current_score')
        .not('current_score', 'is', null)
        .order('current_score', { ascending: true })
        .limit(3),
    ]);

    champions = (topResult.data || []) as typeof champions;
    worstOffenders = (bottomResult.data || []) as typeof worstOffenders;
  }

  return {
    memberCount: membersResult.count || 0,
    stateCount: distinctStates.size,
    chapterCount: chaptersResult.count || 0,
    activeCampaignCount: campaignCountResult.count || 0,
    campaigns: campaignsWithCounts,
    events: (eventsResult.data || []) as Array<{
      id: string;
      title: string;
      slug: string;
      start_date: string;
      is_virtual: boolean;
      city: string | null;
      state: string | null;
    }>,
    posts: (postsResult.data || []) as Array<{
      id: string;
      title: string;
      slug: string;
      excerpt: string | null;
      published_at: string | null;
    }>,
    champions,
    worstOffenders,
    sessionName,
    sessionSlug,
  };
}

export default async function HomePage() {
  let data;
  try {
    data = await getHomePageData();
  } catch (err) {
    console.error('[homepage] Failed to load homepage data:', err);
    data = {
      memberCount: 0,
      stateCount: 0,
      chapterCount: 0,
      activeCampaignCount: 0,
      campaigns: [],
      events: [],
      posts: [],
      champions: [],
      worstOffenders: [],
      sessionName: '',
      sessionSlug: '',
    };
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <HeroSection
        memberCount={data.memberCount}
        campaignCount={data.activeCampaignCount}
        stateCount={data.stateCount}
      />

      <UrgencyBar activeCampaignCount={data.activeCampaignCount} />

      <ActivityFeed />

      <ScorecardSpotlight
        champions={data.champions}
        worstOffenders={data.worstOffenders}
        sessionName={data.sessionName}
        sessionSlug={data.sessionSlug}
      />

      <CampaignGrid campaigns={data.campaigns} />

      <EventPreview events={data.events} />

      {/* Latest Blog Posts */}
      {data.posts.length > 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="font-heading text-3xl font-bold">Latest News</h2>
              <Button asChild variant="outline">
                <Link href="/blog">View All Posts</Link>
              </Button>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {data.posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group rounded-lg border bg-card p-6 transition-all hover:border-rlc-red hover:shadow-md"
                >
                  <h3 className="mb-2 font-heading text-lg font-semibold group-hover:text-rlc-red">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <StatsBar
        stats={[
          { value: data.memberCount, label: 'Active Members', suffix: '+' },
          { value: data.chapterCount, label: 'State Chapters' },
          { value: data.stateCount, label: 'States Active' },
          { value: data.activeCampaignCount, label: 'Active Campaigns' },
        ]}
      />

      {/* Join CTA */}
      <section className="bg-gradient-to-br from-rlc-red to-rlc-red/80 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 font-heading text-3xl font-bold uppercase">
            Ready to Defend Liberty?
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-white/90">
            Join {data.memberCount > 0 ? `${data.memberCount.toLocaleString()}+ ` : ''}liberty-minded
            Republicans working to advance freedom within the GOP.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-white text-rlc-red hover:bg-white/90 font-semibold text-base px-8"
            >
              <Link href="/join">Become a Member</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10 text-base"
            >
              <Link href="/donate">Support Our Mission</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
