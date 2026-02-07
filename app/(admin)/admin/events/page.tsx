import { Metadata } from 'next';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, MapPin, Users, Video } from 'lucide-react';
import { Event } from '@/types';

export const metadata: Metadata = {
  title: 'Events - Admin',
  description: 'Manage RLC events',
};

interface EventRow extends Event {
  chapter?: { id: string; name: string } | null;
  organizer?: { first_name: string; last_name: string } | null;
}

interface EventWithCount extends EventRow {
  registrationCount: number;
}

async function getEvents(): Promise<EventWithCount[]> {
  const supabase = createServerClient();

  const { data } = await supabase
    .from('rlc_events')
    .select(`
      *,
      chapter:rlc_chapters(id, name),
      organizer:rlc_members(first_name, last_name)
    `)
    .order('start_date', { ascending: false });

  const events = (data || []) as EventRow[];

  // Get registration counts
  const eventsWithCounts = await Promise.all(
    events.map(async (event) => {
      const { count } = await supabase
        .from('rlc_event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id);

      return { ...event, registrationCount: count || 0 };
    })
  );

  return eventsWithCounts;
}

export default async function AdminEventsPage() {
  const events = await getEvents();

  const now = new Date();
  const upcomingEvents = events.filter((e) => new Date(e.start_date) >= now);
  const pastEvents = events.filter((e) => new Date(e.start_date) < now);

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    published: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  const EventCard = ({ event }: { event: typeof events[0] }) => (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${
                statusColors[event.status] || 'bg-gray-100'
              }`}
            >
              {event.status}
            </span>
            {event.is_virtual && (
              <span className="flex items-center gap-1 rounded-full bg-rlc-blue/10 px-2 py-1 text-xs font-medium text-rlc-blue">
                <Video className="h-3 w-3" />
                Virtual
              </span>
            )}
          </div>
          <h3 className="font-semibold">{event.title}</h3>
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
    </div>
  );

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="mt-2 text-muted-foreground">
            {events.length} total events
          </p>
        </div>
        <Button className="bg-rlc-red hover:bg-rlc-red/90">
          <Plus className="mr-2 h-4 w-4" />
          Create Event
        </Button>
      </div>

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
