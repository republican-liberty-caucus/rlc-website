import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Calendar, MapPin, Video, Users, Clock, DollarSign } from 'lucide-react';
import { RegistrationButton } from '@/components/events/registration-button';

interface EventDetailProps {
  params: Promise<{ slug: string }>;
}

interface EventRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  event_type: string | null;
  start_date: string;
  end_date: string | null;
  timezone: string;
  is_virtual: boolean;
  location_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  virtual_url: string | null;
  registration_required: boolean;
  max_attendees: number | null;
  registration_fee: number | null;
  registration_deadline: string | null;
  chapter_id: string | null;
  status: string;
  chapter: { name: string; slug: string } | null;
}

async function getEvent(slug: string) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('rlc_events')
    .select(`
      *,
      chapter:rlc_chapters(name, slug)
    `)
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error || !data) return null;
  return data as EventRow;
}

export async function generateMetadata({ params }: EventDetailProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return { title: 'Event Not Found' };

  return {
    title: `${event.title} - RLC Events`,
    description: event.description?.slice(0, 160) || `Join us for ${event.title}`,
  };
}

export default async function EventDetailPage({ params }: EventDetailProps) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  const supabase = createServerClient();
  const { count: registrationCount } = await supabase
    .from('rlc_event_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', event.id)
    .in('registration_status', ['registered', 'checked_in']);

  const currentCount = registrationCount || 0;
  const spotsRemaining = event.max_attendees ? event.max_attendees - currentCount : null;

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      {/* Hero */}
      <section className="bg-rlc-blue py-16 text-white">
        <div className="container mx-auto px-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {event.is_virtual && (
              <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-sm">
                <Video className="h-4 w-4" /> Virtual
              </span>
            )}
            {event.chapter && (
              <Link
                href={`/chapters/${event.chapter.slug}`}
                className="rounded-full bg-white/20 px-3 py-1 text-sm hover:bg-white/30"
              >
                {event.chapter.name}
              </Link>
            )}
            {event.event_type && (
              <span className="rounded-full bg-white/20 px-3 py-1 text-sm capitalize">
                {event.event_type.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <h1 className="text-4xl font-bold">{event.title}</h1>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Date & Location */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-rlc-red" />
                <div>
                  <p className="font-semibold">{formatDate(event.start_date)}</p>
                  {event.end_date && (
                    <p className="text-sm text-muted-foreground">
                      through {formatDate(event.end_date)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-rlc-red" />
                <p className="text-muted-foreground">{event.timezone}</p>
              </div>

              {!event.is_virtual && event.location_name && (
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 text-rlc-red" />
                  <div>
                    <p className="font-semibold">{event.location_name}</p>
                    {event.address && (
                      <p className="text-sm text-muted-foreground">{event.address}</p>
                    )}
                    {event.city && event.state && (
                      <p className="text-sm text-muted-foreground">
                        {event.city}, {event.state} {event.postal_code}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {event.is_virtual && event.virtual_url && (
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5 text-rlc-red" />
                  <p className="text-muted-foreground">Virtual event link will be shared upon registration</p>
                </div>
              )}
            </div>

            {/* Description */}
            {event.description && (
              <div>
                <h2 className="mb-4 text-2xl font-bold text-rlc-blue">About This Event</h2>
                <div className="prose max-w-none text-muted-foreground whitespace-pre-wrap">
                  {event.description}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Registration Card */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="mb-4 text-lg font-semibold">Registration</h3>

              <div className="mb-4 space-y-2 text-sm">
                {event.registration_fee && event.registration_fee > 0 && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>{formatCurrency(Number(event.registration_fee))}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {currentCount} registered
                    {spotsRemaining !== null && ` (${spotsRemaining} spots remaining)`}
                  </span>
                </div>
                {event.registration_deadline && (
                  <p className="text-muted-foreground">
                    Registration deadline: {formatDate(event.registration_deadline)}
                  </p>
                )}
              </div>

              {event.registration_required ? (
                <RegistrationButton
                  eventId={event.id}
                  eventSlug={event.slug}
                  maxAttendees={event.max_attendees}
                  currentCount={currentCount}
                  registrationDeadline={event.registration_deadline}
                  registrationFee={event.registration_fee}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No registration required. All are welcome!
                </p>
              )}
            </div>

            {/* Back */}
            <Link href="/events" className="block text-sm text-rlc-red hover:underline">
              &larr; Back to all events
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
