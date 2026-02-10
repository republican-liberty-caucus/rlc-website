import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import { OFFICER_TITLE_LABELS } from '@/lib/validations/officer-position';
import { MapPin, Users, Calendar, ExternalLink, Mail, Phone, FileText } from 'lucide-react';
import type { Charter, OfficerTitle } from '@/types';

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

  const description = charter.description
    || `Learn about ${charter.name}, find upcoming events, and get involved with liberty-minded Republicans in ${charter.state_code || 'your area'}.`;

  return {
    title: `${charter.name} - Republican Liberty Caucus`,
    description,
  };
}

export default async function CharterDetailPage({ params }: CharterDetailProps) {
  const { slug } = await params;
  const charter = await getCharter(slug);
  if (!charter) notFound();

  const supabase = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [memberCountResult, eventsResult, officersResult] = await Promise.all([
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
    (supabase as any)
      .from('rlc_organizational_positions')
      .select(`
        id, title, committee_name, started_at,
        member:rlc_members!rlc_organizational_positions_contact_id_fkey(first_name, last_name)
      `)
      .eq('charter_id', charter.id)
      .eq('is_active', true)
      .order('started_at', { ascending: true }),
  ]);

  const memberCount = memberCountResult.count || 0;
  const events = (eventsResult.data || []) as Array<{
    id: string; title: string; slug: string; start_date: string;
    is_virtual: boolean; city: string | null; state: string | null;
  }>;
  const officers = (officersResult.data || []) as Array<{
    id: string;
    title: OfficerTitle;
    committee_name: string | null;
    started_at: string;
    member: { first_name: string; last_name: string } | null;
  }>;

  const hasContact = charter.contact_email || charter.website_url || charter.contact_phone || charter.facebook_url || charter.twitter_url;

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
            {/* About */}
            {charter.description && (
              <section>
                <h2 className="mb-4 text-2xl font-bold text-rlc-blue">About</h2>
                <p className="whitespace-pre-line text-muted-foreground">{charter.description}</p>
              </section>
            )}

            {/* Officers */}
            {officers.length > 0 && (
              <section>
                <h2 className="mb-4 text-2xl font-bold text-rlc-blue">Officers</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {officers.map((o) => (
                    <div key={o.id} className="rounded-lg border bg-card p-4">
                      <p className="text-sm text-muted-foreground">
                        {OFFICER_TITLE_LABELS[o.title]}
                        {o.committee_name && ` — ${o.committee_name}`}
                      </p>
                      <p className="font-semibold">
                        {o.member ? `${o.member.first_name} ${o.member.last_name}` : 'Vacant'}
                      </p>
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
            {hasContact && (
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
                  {charter.contact_phone && (
                    <a
                      href={`tel:${charter.contact_phone}`}
                      className="flex items-center gap-2 text-sm text-rlc-red hover:underline"
                    >
                      <Phone className="h-4 w-4" />
                      {charter.contact_phone}
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
                  {charter.facebook_url && (
                    <a
                      href={charter.facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-rlc-red hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Facebook
                    </a>
                  )}
                  {charter.twitter_url && (
                    <a
                      href={charter.twitter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-rlc-red hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Twitter/X
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Bylaws */}
            {charter.bylaws_url && (
              <div className="rounded-lg border bg-card p-6">
                <h3 className="mb-4 text-lg font-semibold">Bylaws</h3>
                <a
                  href={charter.bylaws_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-rlc-red hover:underline"
                >
                  <FileText className="h-4 w-4" />
                  View Bylaws
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
