import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import { MapPin, Users, Calendar, ExternalLink, Mail } from 'lucide-react';
import type { Chapter } from '@/types';

interface ChapterDetailProps {
  params: Promise<{ slug: string }>;
}

async function getChapter(slug: string) {
  const supabase = createServerClient();

  const { data: chapter, error } = await supabase
    .from('rlc_chapters')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (error || !chapter) return null;
  return chapter as Chapter;
}

export async function generateMetadata({ params }: ChapterDetailProps): Promise<Metadata> {
  const { slug } = await params;
  const chapter = await getChapter(slug);
  if (!chapter) return { title: 'Chapter Not Found' };

  return {
    title: `${chapter.name} - Republican Liberty Caucus`,
    description: `Learn about ${chapter.name}, find upcoming events, and get involved with liberty-minded Republicans in ${chapter.state_code || 'your area'}.`,
  };
}

export default async function ChapterDetailPage({ params }: ChapterDetailProps) {
  const { slug } = await params;
  const chapter = await getChapter(slug);
  if (!chapter) notFound();

  const supabase = createServerClient();

  const [memberCountResult, eventsResult] = await Promise.all([
    supabase
      .from('rlc_members')
      .select('*', { count: 'exact', head: true })
      .eq('primary_chapter_id', chapter.id),
    supabase
      .from('rlc_events')
      .select('id, title, slug, start_date, is_virtual, city, state')
      .eq('chapter_id', chapter.id)
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

  const leadership = chapter.leadership as Record<string, string> | null;

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      {/* Hero */}
      <section className="bg-rlc-blue py-16 text-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4">
            {chapter.state_code && (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-2xl font-bold">
                {chapter.state_code}
              </div>
            )}
            <div>
              <h1 className="text-4xl font-bold">{chapter.name}</h1>
              <p className="mt-2 text-xl text-white/90">
                Republican Liberty Caucus {chapter.state_code ? `of ${chapter.state_code}` : 'Chapter'}
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
              {chapter.chapter_level.replace(/_/g, ' ')}
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
                <p className="text-muted-foreground">
                  No upcoming events. Check back soon!
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
                Join {chapter.name} and help advance liberty in {chapter.state_code || 'your state'}.
              </p>
              <Button asChild className="w-full bg-rlc-red hover:bg-rlc-red/90">
                <Link href="/join">Join the RLC</Link>
              </Button>
            </div>

            {/* Contact */}
            {(chapter.contact_email || chapter.website_url) && (
              <div className="rounded-lg border bg-card p-6">
                <h3 className="mb-4 text-lg font-semibold">Contact</h3>
                <div className="space-y-3">
                  {chapter.contact_email && (
                    <a
                      href={`mailto:${chapter.contact_email}`}
                      className="flex items-center gap-2 text-sm text-rlc-red hover:underline"
                    >
                      <Mail className="h-4 w-4" />
                      {chapter.contact_email}
                    </a>
                  )}
                  {chapter.website_url && (
                    <a
                      href={chapter.website_url}
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
