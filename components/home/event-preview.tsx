import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { UrgencyBadge } from '@/components/ui/urgency-badge';
import { Calendar, MapPin, Monitor } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils';

interface PreviewEvent {
  id: string;
  title: string;
  slug: string;
  start_date: string;
  is_virtual: boolean;
  city: string | null;
  state: string | null;
}

interface EventPreviewProps {
  events: PreviewEvent[];
}

export function EventPreview({ events }: EventPreviewProps) {
  return (
    <section className="bg-muted/30 py-16">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="font-heading text-3xl font-bold">Upcoming Events</h2>
          <Button asChild variant="outline">
            <Link href="/events">View All Events</Link>
          </Button>
        </div>

        {events.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.slug}`}
                className="group rounded-lg border bg-card p-6 transition-all hover:border-rlc-red hover:shadow-md"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {event.is_virtual ? (
                      <>
                        <Monitor className="h-3.5 w-3.5" />
                        <span>Virtual</span>
                      </>
                    ) : event.city && event.state ? (
                      <>
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{event.city}, {event.state}</span>
                      </>
                    ) : null}
                  </div>
                  <UrgencyBadge deadline={event.start_date} />
                </div>
                <h3 className="mb-2 font-heading text-lg font-semibold group-hover:text-rlc-red">
                  {event.title}
                </h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{formatDate(event.start_date)}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Upcoming Events"
            description="Find your local charter to stay in the loop on upcoming events."
            action={{ label: 'Find Your Charter', href: '/charters' }}
            icon={<Calendar className="h-12 w-12" />}
          />
        )}
      </div>
    </section>
  );
}
