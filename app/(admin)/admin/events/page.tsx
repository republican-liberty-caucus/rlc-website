import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Calendar, MapPin, Users, Video } from 'lucide-react';
import type { Event } from '@/types';

export const metadata: Metadata = {
  title: 'Events - Admin',
  description: 'Manage RLC events',
};

interface EventRow extends Event {
  charter?: { id: string; name: string } | null;
  organizer?: { first_name: string; last_name: string } | null;
}

interface EventWithCount extends EventRow {
  registrationCount: number;
}

async function getEvents(visibleCharterIds: string[] | null): Promise<EventWithCount[]> {
  const supabase = createServerClient();

  let query = supabase
    .from('rlc_events')
    .select(`
      *,
      charter:rlc_charters(id, name),
      organizer:rlc_members(first_name, last_name)
    `)
    .order('start_date', { ascending: false });

  if (visibleCharterIds !== null && visibleCharterIds.length > 0) {
    query = query.in('charter_id', visibleCharterIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  const events = (data || []) as EventRow[];
  if (events.length === 0) return [];

  // Single aggregated query for registration counts (avoids N+1)
  const { data: regRows, error: regError } = await supabase
    .from('rlc_event_registrations')
    .select('event_id')
    .in('event_id', events.map((e) => e.id));

  if (regError) {
    throw new Error(`Failed to fetch registration counts: ${regError.message}`);
  }

  const countMap: Record<string, number> = {};
  for (const row of (regRows || []) as { event_id: string }[]) {
    countMap[row.event_id] = (countMap[row.event_id] || 0) + 1;
  }

  return events.map((event) => ({
    ...event,
    registrationCount: countMap[event.id] || 0,
  }));
}

export default async function AdminEventsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const events = await getEvents(ctx.visibleCharterIds);

  const now = new Date();
  const upcomingEvents = events.filter((e) => new Date(e.start_date) >= now);
  const pastEvents = events.filter((e) => new Date(e.start_date) < now);

  const EventCard = ({ event }: { event: typeof events[0] }) => {
    const fillPct = event.max_attendees
      ? Math.min(Math.round((event.registrationCount / event.max_attendees) * 100), 100)
      : null;

    return (
      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <StatusBadge status={event.status} type="event" />
                {event.is_virtual && (
                  <span className="flex items-center gap-1 rounded-full bg-rlc-blue/10 px-2 py-1 text-xs font-medium text-rlc-blue">
                    <Video className="h-3 w-3" />
                    Virtual
                  </span>
                )}
              </div>
              <h3 className="font-heading font-semibold">{event.title}</h3>
            </div>
          </div>

          <div className="mb-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {formatDate(event.start_date)}
            </div>
            {!event.is_virtual && event.city && event.state && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {event.city}, {event.state}
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              {event.registrationCount} registered
              {event.max_attendees && ` / ${event.max_attendees} max`}
            </div>
            {fillPct !== null && (
              <div className="pt-1">
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full transition-all ${fillPct >= 90 ? 'bg-red-500' : fillPct >= 70 ? 'bg-orange-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.max(fillPct, event.registrationCount > 0 ? 2 : 0)}%` }}
                  />
                </div>
              </div>
            )}
            {event.registration_fee && (
              <div className="text-muted-foreground">
                Fee: {formatCurrency(Number(event.registration_fee))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Link href={`/admin/events/${event.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                Edit
              </Button>
            </Link>
            <Link href={`/admin/events/${event.id}/registrations`}>
              <Button variant="outline" size="sm">
                Registrations
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div>
      <PageHeader
        title="Events"
        count={events.length}
        className="mb-8"
        action={
          <Link href="/admin/events/new">
            <Button className="bg-rlc-red hover:bg-rlc-red/90">
              <Plus className="mr-2 h-4 w-4" />
              Create Event
            </Button>
          </Link>
        }
      />

      {/* Upcoming Events */}
      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold">
          Upcoming Events ({upcomingEvents.length})
        </h2>
        {upcomingEvents.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/50 p-8 text-center">
            <p className="text-muted-foreground">No upcoming events</p>
          </div>
        )}
      </section>

      {/* Past Events */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">
          Past Events ({pastEvents.length})
        </h2>
        {pastEvents.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pastEvents.slice(0, 6).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/50 p-8 text-center">
            <p className="text-muted-foreground">No past events</p>
          </div>
        )}
        {pastEvents.length > 6 && (
          <div className="mt-4 text-center">
            <Button variant="outline">View All Past Events</Button>
          </div>
        )}
      </section>
    </div>
  );
}
