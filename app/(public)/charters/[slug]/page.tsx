import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import { MapPin, Users, Calendar, ExternalLink, Mail } from 'lucide-react';
import type { Charter } from '@/types';

interface CharterDetailProps {
  params: Promise<{ slug: string }>;
}

async function getCharter(slug: string) {
  const supabase = createServerClient();

  const { data: charter, error } = await supabase
    .from('rlc_charters')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (error || !charter) return null;
  return charter as Charter;
}

export async function generateMetadata({ params }: CharterDetailProps): Promise<Metadata> {
  const { slug } = await params;
  const charter = await getCharter(slug);
  if (!charter) return { title: 'Charter Not Found' };

  return {
    title: `${charter.name} - Republican Liberty Caucus`,
    description: `Learn about ${charter.name}, find upcoming events, and get involved with liberty-minded Republicans in ${charter.state_code || 'your area'}.`,
  };
}

export default async function CharterDetailPage({ params }: CharterDetailProps) {
  const { slug } = await params;
  const charter = await getCharter(slug);
  if (!charter) notFound();

  const supabase = createServerClient();

  const [memberCountResult, eventsResult] = await Promise.all([
    supabase
      .from('rlc_members')
      .select('*', { count: 'exact', head: true })
      .eq('primary_charter_id', charter.id),
    supabase
      .from('rlc_events')
      .select('id, title, slug, start_date, is_virtual, city, state')
      .eq('charter_id', charter.id)
      .eq('status', 'published')
      .gte('start_date', new Date().toISOString())
      .order('start_date')
      .limit(5),
  ]);

  const memberCount = memberCountResult.count || 0;
  const events = (eventsResult.data || []) as Array<{
    id: string; title: string; slug: string; start_date: string;
    is_virtual: boolean; city: string | null; state: string | null;
  }>;

  const leadership = charter.leadership as Record<string, string> | null;

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      {/* Hero */}
      <section className="bg-rlc-blue py-16 text-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4">
            {charter.state_code && (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-2xl font-bold">
                {charter.state_code}
              </div>
            )}
            <div>
              <h1 className="text-4xl font-bold">{charter.name}</h1>
              <p className="mt-2 text-xl text-white/90">
                Republican Liberty Caucus {charter.state_code ? `of ${charter.state_code}` : 'Charter'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-b bg-muted/50 py-6">
        <div className="container mx-auto flex flex-wrap gap-8 px-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-rlc-red" />
            <span className="font-semibold">{memberCount}</span>
            <span className="text-muted-foreground">Members</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-rlc-red" />
            <span className="font-semibold">{events.length}</span>
            <span className="text-muted-foreground">Upcoming Events</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-rlc-red" />
            <span className="text-muted-foreground capitalize">
              {charter.charter_level.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Leadership */}
            {leadership && Object.keys(leadership).length > 0 && (
              <section>
                <h2 className="mb-4 text-2xl font-bold text-rlc-blue">Leadership</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {Object.entries(leadership).map(([role, name]) => (
                    <div key={role} className="rounded-lg border bg-card p-4">
                      <p className="text-sm text-muted-foreground capitalize">
                        {role.replace(/_/g, ' ')}
                      </p>
                      <p className="font-semibold">{name}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming Events */}
            <section>
              <h2 className="mb-4 text-2xl font-bold text-rlc-blue">Upcoming Events</h2>
              {events.length > 0 ? (
                <div className="space-y-3">
                  {events.map((event) => (
                    <Link
                      key={event.id}
                      href={`/events/${event.slug}`}
                      className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:border-rlc-red"
                    >
                      <div>
                        <h3 className="font-semibold">{event.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(event.start_date)}
                          {!event.is_virtual && event.city && event.state && (
                            <> &middot; {event.city}, {event.state}</>
                          )}
                          {event.is_virtual && <> &middot; Virtual</>}
                        </p>
                      </div>
                      <span className="text-sm text-rlc-red">View &rarr;</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No upcoming events for this charter.{' '}
                  <Link href="/events" className="text-rlc-red hover:underline">Browse all events →</Link>
                </p>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Join CTA */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="mb-2 text-lg font-semibold">Get Involved</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Join {charter.name} and help advance liberty in {charter.state_code || 'your state'}.
              </p>
              <Button asChild className="w-full bg-rlc-red hover:bg-rlc-red/90">
                <Link href="/join">Join the RLC</Link>
              </Button>
            </div>

            {/* Contact */}
            {(charter.contact_email || charter.website_url) && (
              <div className="rounded-lg border bg-card p-6">
                <h3 className="mb-4 text-lg font-semibold">Contact</h3>
                <div className="space-y-3">
                  {charter.contact_email && (
                    <a
                      href={`mailto:${charter.contact_email}`}
                      className="flex items-center gap-2 text-sm text-rlc-red hover:underline"
                    >
                      <Mail className="h-4 w-4" />
                      {charter.contact_email}
                    </a>
                  )}
                  {charter.website_url && (
                    <a
                      href={charter.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-rlc-red hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Visit Website
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
