import { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/route-helpers';
import { EventDetailForm } from '@/components/admin/event-detail-form';

export const metadata: Metadata = {
  title: 'Create Event - Admin',
};

export default async function AdminCreateEventPage() {
  const { ctx, supabase } = await requireAdmin();

  let charterQuery = supabase
    .from('rlc_charters')
    .select('id, name')
    .eq('status', 'active')
    .order('name');

  if (ctx.visibleCharterIds !== null && ctx.visibleCharterIds.length > 0) {
    charterQuery = charterQuery.in('id', ctx.visibleCharterIds);
  }

  const { data: charters } = await charterQuery;

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/events" className="text-sm text-muted-foreground hover:underline">
          &larr; Back to Events
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Create Event</h1>
      </div>

      <EventDetailForm
        event={null}
        charters={(charters || []) as { id: string; name: string }[]}
      />
    </div>
  );
}
