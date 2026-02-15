import { Metadata } from 'next';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin/route-helpers';
import { EventDetailForm } from '@/components/admin/event-detail-form';
import type { Event } from '@/types';

interface EventDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = createServerClient();
  const { data } = await supabase.from('rlc_events').select('title').eq('id', id).single();
  const event = data as { title: string } | null;
  return { title: event ? `${event.title} - Admin` : 'Event - Admin' };
}

export default async function AdminEventDetailPage({ params }: EventDetailPageProps) {
  const { ctx, supabase } = await requireAdmin();

  const { id } = await params;

  const { data: eventData, error: eventError } = await supabase
    .from('rlc_events')
    .select(`*, organizer:rlc_contacts!organizer_id(id, first_name, last_name, email)`)
    .eq('id', id)
    .single();

  if (eventError || !eventData) notFound();
  const { organizer, ...eventFields } = eventData as Event & {
    organizer: { id: string; first_name: string; last_name: string; email: string | null } | null;
  };
  const event = eventFields as Event;

  let chartersQuery = supabase.from('rlc_charters').select('id, name').eq('status', 'active').order('name');
  if (ctx.visibleCharterIds !== null && ctx.visibleCharterIds.length > 0) {
    chartersQuery = chartersQuery.in('id', ctx.visibleCharterIds);
  }

  const [chartersResult, regCountResult] = await Promise.all([
    chartersQuery,
    supabase.from('rlc_event_registrations').select('*', { count: 'exact', head: true }).eq('event_id', id),
  ]);

  // Check charter visibility
  if (event.charter_id && ctx.visibleCharterIds !== null) {
    if (!ctx.visibleCharterIds.includes(event.charter_id)) {
      redirect('/admin/events?error=forbidden');
    }
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/events" className="text-sm text-muted-foreground hover:underline">
          &larr; Back to Events
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-3xl font-bold">{event.title}</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {regCountResult.count || 0} registrations
            </span>
            <Link
              href={`/admin/events/${id}/registrations`}
              className="text-sm text-rlc-red hover:underline"
            >
              View Registrations
            </Link>
          </div>
        </div>
      </div>

      <EventDetailForm
        event={event}
        charters={(chartersResult.data || []) as { id: string; name: string }[]}
        organizer={organizer}
      />
    </div>
  );
}
