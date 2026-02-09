import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { auth } from '@clerk/nextjs/server';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { createServerClient, getMemberByClerkId } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { MemberContextBadge } from '@/components/shared/member-context-badge';
import { Calendar } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Upcoming Republican Liberty Caucus events, meetings, and conventions.',
};

interface EventWithCharter {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  featured_image_url: string | null;
  start_date: string;
  is_virtual: boolean;
  city: string | null;
  state: string | null;
  charter: { name: string; slug: string } | null;
}

async function getEvents(): Promise<EventWithCharter[]> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from('rlc_events')
      .select(`
        *,
        charter:rlc_charters(name, slug)
      `)
      .eq('status', 'published')
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })
      .limit(20);

    return (data || []) as EventWithCharter[];
  } catch {
    return [];
  }
}

export default async function EventsPage() {
  const events = await getEvents();

  // Check member registrations
  let registeredEventIds = new Set<string>();
  const { userId } = await auth();
  if (userId) {
    const member = await getMemberByClerkId(userId);
    if (member) {
      try {
        const supabase = createServerClient();
        const { data: registrations } = await supabase
          .from('rlc_event_registrations')
          .select('event_id')
          .eq('member_id', member.id);
        registeredEventIds = new Set((registrations || []).map((r: { event_id: string }) => r.event_id));
      } catch {
        // Non-fatal — just don't show registration badges
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      {/* Hero Section */}
      <section className="bg-rlc-blue py-16 text-white">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold">Upcoming Events</h1>
          <p className="mt-4 text-xl text-white/90">
            Join us at our next meeting, convention, or event
          </p>
        </div>
      </section>

      {/* Events List */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {events.length > 0 ? (
            <div className="grid gap-6">
              {events.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.slug}`}
                  className="group overflow-hidden rounded-lg border bg-card transition-colors hover:border-rlc-red"
                >
                  {event.featured_image_url && (
                    <div className="relative h-48 w-full">
                      <Image
                        src={event.featured_image_url}
                        alt={event.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {registeredEventIds.has(event.id) && (
                          <MemberContextBadge label="You're registered" variant="registered" />
                        )}
                        {event.is_virtual && (
                          <span className="rounded-full bg-rlc-blue/10 px-2 py-1 text-xs font-medium text-rlc-blue">
                            Virtual
                          </span>
                        )}
                        {event.charter && (
                          <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                            {event.charter.name}
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl font-semibold group-hover:text-rlc-red">
                        {event.title}
                      </h2>
                      {event.description && (
                        <p className="mt-2 line-clamp-2 text-muted-foreground">
                          {event.description}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-semibold text-rlc-red">
                        {formatDate(event.start_date)}
                      </div>
                      {!event.is_virtual && event.city && event.state && (
                        <div className="mt-1 text-sm text-muted-foreground">
                          {event.city}, {event.state}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Calendar className="h-12 w-12" />}
              title="No Upcoming Events"
              description="Find your local charter to stay in the loop on upcoming RLC events and meetings."
              action={{ label: 'Find Your Charter', href: '/charters' }}
            />
          )}
        </div>
      </section>

      {/* Host an Event CTA */}
      <section className="bg-muted py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-2xl font-bold">Want to Host an Event?</h2>
          <p className="mb-6 text-muted-foreground">
            If you&apos;re a charter leader or member interested in organizing an RLC event, contact
            your state charter or the national office.
          </p>
          <Button asChild className="bg-rlc-red hover:bg-rlc-red/90">
            <Link href="/contact">Contact Us</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
