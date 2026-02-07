import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getMemberByClerkId } from '@/lib/supabase/server';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import { Calendar, MapPin, Video } from 'lucide-react';

export const metadata: Metadata = {
  title: 'My Events',
  description: 'View your RLC event registrations',
};

async function getEventRegistrations(memberId: string) {
  try {
    const supabase = createServerClient();
    const { data: registrations } = await supabase
      .from('rlc_event_registrations')
      .select(`
        *,
        event:rlc_events(*)
      `)
      .eq('member_id', memberId)
      .order('created_at', { ascending: false });

    return registrations || [];
  } catch {
    return [];
  }
}

export default async function MemberEventsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const member = await getMemberByClerkId(userId);

  if (!member) {
    redirect('/dashboard');
  }

  const registrations = await getEventRegistrations(member.id);

  const now = new Date();
  const upcomingEvents = registrations.filter(
    (r) => r.event && new Date(r.event.start_date) >= now
  );
  const pastEvents = registrations.filter(
    (r) => r.event && new Date(r.event.start_date) < now
  );

  const statusColors: Record<string, string> = {
    registered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    waitlist: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">My Events</h1>
          <p className="mt-2 text-muted-foreground">
            View your event registrations and attendance history.
          </p>
        </div>
        <Button asChild className="bg-rlc-red hover:bg-rlc-red/90">
          <Link href="/events">Browse Events</Link>
        </Button>
      </div>

      {/* Upcoming Events */}
      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold">Upcoming Events</h2>
        {upcomingEvents.length > 0 ? (
          <div className="grid gap-4">
            {upcomingEvents.map((registration) => {
              const event = registration.event;
              if (!event) return null;

              return (
                <div
                  key={registration.id}
                  className="rounded-lg border bg-card p-6"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${
                            statusColors[registration.registration_status] || 'bg-gray-100'
                          }`}
                        >
                          {registration.registration_status}
                        </span>
                        {event.is_virtual && (
                          <span className="flex items-center gap-1 rounded-full bg-rlc-blue/10 px-2 py-1 text-xs font-medium text-rlc-blue">
                            <Video className="h-3 w-3" />
                            Virtual
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold">{event.title}</h3>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(event.start_date)}
                        </span>
                        {!event.is_virtual && event.city && event.state && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {event.city}, {event.state}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/events/${event.slug}`}>View Details</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/50 p-8 text-center">
            <p className="text-muted-foreground">No upcoming event registrations.</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/events">Browse Upcoming Events</Link>
            </Button>
          </div>
        )}
      </section>

      {/* Past Events */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Past Events</h2>
        {pastEvents.length > 0 ? (
          <div className="rounded-lg border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">Event</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Location</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pastEvents.map((registration) => {
                    const event = registration.event;
                    if (!event) return null;

                    return (
                      <tr key={registration.id} className="border-b last:border-0">
                        <td className="px-4 py-3 text-sm font-medium">{event.title}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(event.start_date)}</td>
                        <td className="px-4 py-3 text-sm">
                          {event.is_virtual ? (
                            <span className="text-rlc-blue">Virtual</span>
                          ) : event.city && event.state ? (
                            `${event.city}, ${event.state}`
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {registration.checked_in_at ? (
                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                              Attended
                            </span>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                              Registered
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/50 p-8 text-center">
            <p className="text-muted-foreground">No past event attendance records.</p>
          </div>
        )}
      </section>
    </div>
  );
}
