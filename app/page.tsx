import Link from 'next/link';
import Image from 'next/image';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { HeroSection } from '@/components/home/hero-section';
import { ScorecardSpotlight } from '@/components/home/scorecard-spotlight';
import { Testimonials } from '@/components/home/testimonials';
import { StatsBar } from '@/components/home/stats-bar';
import { EventPreview } from '@/components/home/event-preview';
import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { formatDate } from '@/lib/utils';
import { rewriteWPImageUrl } from '@/lib/wordpress/content';
import { Users, Heart, MapPin } from 'lucide-react';

interface HomePost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: string | null;
  featured_image_url: string | null;
  categories: string[] | null;
}

interface HomeEvent {
  id: string;
  title: string;
  slug: string;
  start_date: string;
  is_virtual: boolean;
  city: string | null;
  state: string | null;
}

interface LegislatorSummary {
  id: string;
  name: string;
  party: string;
  state_code: string;
  current_score: number | null;
}

interface HomePageData {
  memberCount: number;
  charterCount: number;
  legislatorsScoredCount: number;
  events: HomeEvent[];
  posts: HomePost[];
  champions: LegislatorSummary[];
  worstOffenders: LegislatorSummary[];
  sessionName: string;
  sessionSlug: string;
}

async function getHomePageData(): Promise<HomePageData> {
  const supabase = createServerClient();

  const [
    membersResult,
    chartersResult,
    legislatorsScoredResult,
    eventsResult,
    postsResult,
    scorecardResult,
  ] = await Promise.all([
    // Total member count
    supabase
      .from('rlc_contacts')
      .select('id', { count: 'exact', head: true }),

    // Charter count
    supabase
      .from('rlc_charters')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),

    // All-time legislators scored (all legislators in the system have been scored)
    supabase
      .from('rlc_legislators')
      .select('id', { count: 'exact', head: true }),

    // Next 3 upcoming events
    supabase
      .from('rlc_events')
      .select('id, title, slug, start_date, is_virtual, city, state')
      .eq('status', 'published')
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })
      .limit(3),

    // Latest 4 blog posts with featured images
    supabase
      .from('rlc_posts')
      .select('id, title, slug, excerpt, published_at, featured_image_url, categories')
      .eq('status', 'published')
      .not('published_at', 'is', null)
      .not('categories', 'cs', '{"Pages"}')
      .order('published_at', { ascending: false })
      .limit(4),

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
  if (membersResult.error) logger.error('[homepage] members query failed:', membersResult.error);
  if (chartersResult.error) logger.error('[homepage] charters query failed:', chartersResult.error);
  if (legislatorsScoredResult.error) logger.error('[homepage] legislators scored count query failed:', legislatorsScoredResult.error);
  if (eventsResult.error) logger.error('[homepage] events query failed:', eventsResult.error);
  if (postsResult.error) logger.error('[homepage] posts query failed:', postsResult.error);
  // PGRST116 is expected when no published sessions exist; log other errors
  if (scorecardResult.error && scorecardResult.error.code !== 'PGRST116') {
    logger.error('[homepage] scorecard session query failed:', scorecardResult.error);
  }

  // Get top/bottom legislators for scorecard spotlight
  let champions: LegislatorSummary[] = [];
  let worstOffenders: LegislatorSummary[] = [];
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

    if (topResult.error) logger.error('[homepage] top legislators query failed:', topResult.error);
    if (bottomResult.error) logger.error('[homepage] bottom legislators query failed:', bottomResult.error);

    champions = (topResult.data || []) as LegislatorSummary[];
    worstOffenders = (bottomResult.data || []) as LegislatorSummary[];
  }

  return {
    memberCount: membersResult.count || 0,
    charterCount: chartersResult.count || 0,
    legislatorsScoredCount: legislatorsScoredResult.count || 0,
    events: (eventsResult.data || []) as HomeEvent[],
    posts: (postsResult.data || []) as HomePost[],
    champions,
    worstOffenders,
    sessionName,
    sessionSlug,
  };
}

const ctaCards = [
  {
    icon: Users,
    heading: 'Join',
    description:
      'Learn more about how you can play an active role in advancing the cause of liberty inside the GOP.',
    href: '/join',
  },
  {
    icon: Heart,
    heading: 'Donate',
    description:
      'The Republican Liberty Caucus depends on the generosity of donors like you to execute our mission.',
    href: '/donate',
  },
  {
    icon: MapPin,
    heading: 'Get Involved',
    description:
      'With charters in almost every state there\'s bound to be an event near you. Find one and get involved today.',
    href: '/charters',
  },
];

export default async function HomePage() {
  let data: HomePageData;
  try {
    data = await getHomePageData();
  } catch (err) {
    logger.error('[homepage] Failed to load homepage data:', err);
    data = {
      memberCount: 0,
      charterCount: 0,
      legislatorsScoredCount: 0,
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
        charterCount={data.charterCount}
        legislatorsScoredCount={data.legislatorsScoredCount}
      />

      {/* Three CTA Cards */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-3">
            {ctaCards.map((card) => (
              <Link
                key={card.heading}
                href={card.href}
                className="group rounded-lg border bg-card p-8 text-center transition-all hover:border-rlc-red hover:shadow-lg"
              >
                <card.icon className="mx-auto mb-4 h-10 w-10 text-rlc-red" />
                <h3 className="mb-3 font-heading text-xl font-bold group-hover:text-rlc-red">
                  {card.heading}
                </h3>
                <p className="text-sm text-muted-foreground">{card.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Latest News */}
      {data.posts.length > 0 && (
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <h2 className="font-heading text-2xl font-bold sm:text-3xl">Latest News</h2>
              <Button asChild variant="outline">
                <Link href="/blog">View All Posts</Link>
              </Button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {data.posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group overflow-hidden rounded-lg border bg-card transition-all hover:border-rlc-red hover:shadow-md"
                >
                  {post.featured_image_url ? (
                    <div className="relative aspect-video overflow-hidden bg-muted">
                      <Image
                        src={rewriteWPImageUrl(post.featured_image_url)}
                        alt={post.title}
                        fill
                        unoptimized
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-muted">
                      <span className="text-3xl font-bold text-muted-foreground/30">RLC</span>
                    </div>
                  )}
                  <div className="p-4">
                    {post.categories && post.categories.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {post.categories.slice(0, 2).map((cat) => (
                          <span
                            key={cat}
                            className="rounded-full bg-rlc-red/10 px-2 py-0.5 text-xs font-medium text-rlc-red capitalize"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                    <h3 className="mb-1 font-heading text-sm font-semibold leading-snug group-hover:text-rlc-red line-clamp-2">
                      {post.title}
                    </h3>
                    {post.published_at && (
                      <p className="text-xs text-muted-foreground">
                        {formatDate(post.published_at)}
                      </p>
                    )}
                    {post.excerpt && (
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        {post.excerpt}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <ScorecardSpotlight
        champions={data.champions}
        worstOffenders={data.worstOffenders}
        sessionName={data.sessionName}
        sessionSlug={data.sessionSlug}
      />

      <Testimonials />

      <EventPreview events={data.events} />

      <StatsBar
        stats={[
          { value: data.memberCount, label: 'Members', suffix: '+' },
          { value: data.charterCount, label: 'State Charters' },
          { value: data.legislatorsScoredCount, label: 'Legislators Scored', suffix: '+' },
          { value: new Date().getFullYear() - 1991, label: 'Years Fighting', suffix: '+' },
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
              className="border-2 border-white bg-transparent text-white hover:bg-white/15 font-semibold text-base px-8"
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
