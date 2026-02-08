import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
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
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const { id } = await params;
  const supabase = createServerClient();

  const { data: eventData, error: eventError } = await supabase
    .from('rlc_events').select('*').eq('id', id).single();

  if (eventError || !eventData) notFound();
  const event = eventData as Event;

  let chaptersQuery = supabase.from('rlc_chapters').select('id, name').eq('status', 'active').order('name');
  if (ctx.visibleChapterIds !== null && ctx.visibleChapterIds.length > 0) {
    chaptersQuery = chaptersQuery.in('id', ctx.visibleChapterIds);
  }

  const [chaptersResult, regCountResult] = await Promise.all([
    chaptersQuery,
    supabase.from('rlc_event_registrations').select('*', { count: 'exact', head: true }).eq('event_id', id),
  ]);

  // Check chapter visibility
  if (event.chapter_id && ctx.visibleChapterIds !== null) {
    if (!ctx.visibleChapterIds.includes(event.chapter_id)) {
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
        chapters={(chaptersResult.data || []) as { id: string; name: string }[]}
      />
    </div>
  );
}
