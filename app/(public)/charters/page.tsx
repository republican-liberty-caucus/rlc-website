import { Metadata } from 'next';
import Link from 'next/link';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { createServerClient } from '@/lib/supabase/server';
import { USStateMap, type CharterMapData } from '@/components/maps/us-state-map';

export const metadata: Metadata = {
  title: 'State Charters',
  description: 'Find your local Republican Liberty Caucus charter and connect with liberty-minded Republicans in your state.',
};

interface CharterRow {
  slug: string;
  name: string;
  state_code: string | null;
  charter_level: string;
  status: string;
  contact_email: string | null;
  leadership: Record<string, string> | null;
}

async function getCharters(): Promise<CharterRow[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('rlc_charters')
    .select('slug, name, state_code, charter_level, status, contact_email, leadership')
    .in('status', ['active', 'forming'])
    .order('name');

  if (error) {
    console.error('Failed to fetch charters:', error);
    return [];
  }

  return (data || []) as CharterRow[];
}

export default async function ChartersPage() {
  const charters = await getCharters();

  const activeCharters = charters.filter((ch) => ch.status === 'active' && ch.charter_level === 'state');

  // Build map data: only state-level charters with a state_code, deduplicated per state
  const seenStates = new Set<string>();
  const mapCharters: CharterMapData[] = charters
    .filter((ch): ch is CharterRow & { state_code: string } => {
      if (ch.state_code === null || ch.charter_level !== 'state') return false;
      if (seenStates.has(ch.state_code)) return false;
      seenStates.add(ch.state_code);
      return true;
    })
    .map((ch) => ({
      slug: ch.slug,
      name: ch.name,
      state_code: ch.state_code,
      status: ch.status === 'active' ? 'active' : 'forming',
      contact_email: ch.contact_email,
      leadership: ch.leadership,
    }));

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      {/* Hero Section */}
      <section className="bg-rlc-blue py-16 text-white">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold sm:text-3xl md:text-4xl">State Charters</h1>
          <p className="mt-4 text-xl text-white/90">
            Connect with liberty-minded Republicans in your state
          </p>
        </div>
      </section>

      {/* Interactive Map */}
      <section className="border-b py-12">
        <div className="container mx-auto px-4">
          <h2 className="mb-2 text-center text-2xl font-bold">Find Your Charter</h2>
          <p className="mb-8 text-center text-muted-foreground">
            Click your state to view your local charter or learn how to start one
          </p>
          <div className="mx-auto max-w-4xl">
            <USStateMap charters={mapCharters} />
          </div>
        </div>
      </section>

      {/* Charters Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <p className="text-lg text-muted-foreground">
              The RLC has charters across the country working to advance liberty within the
              Republican Party. Find your state charter below or contact us to start one in your
              area.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {activeCharters.map((charter) => (
              <Link
                key={charter.slug}
                href={`/charters/${charter.slug}`}
                className="group rounded-lg border bg-card p-4 transition-colors hover:border-rlc-red hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rlc-red/10 text-sm font-bold text-rlc-red">
                    {charter.state_code || charter.slug.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold group-hover:text-rlc-red">
                      {charter.name}
                    </h3>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Start a Charter CTA */}
          <div className="mt-12 rounded-lg border bg-muted/50 p-8 text-center">
            <h2 className="mb-4 text-2xl font-bold">Don&apos;t See Your State?</h2>
            <p className="mb-6 text-muted-foreground">
              We&apos;re always looking to expand our reach. If you&apos;re interested in starting
              an RLC charter in your state, we&apos;d love to hear from you.
            </p>
            <Button asChild className="bg-rlc-red hover:bg-rlc-red/90">
              <Link href="/contact">Contact Us to Start a Charter</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
