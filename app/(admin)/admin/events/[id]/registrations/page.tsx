import { Metadata } from 'next';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/route-helpers';
import { formatDate } from '@/lib/utils';

interface RegistrationsPageProps {
  params: Promise<{ id: string }>;
}

interface RegistrationRow {
  id: string;
  contact_id: string | null;
  guest_email: string | null;
  guest_name: string | null;
  registration_status: string;
  checked_in_at: string | null;
  created_at: string;
  member: { first_name: string; last_name: string; email: string } | null;
}

export const metadata: Metadata = {
  title: 'Event Registrations - Admin',
};

export default async function AdminEventRegistrationsPage({ params }: RegistrationsPageProps) {
  const { ctx, supabase } = await requireAdmin();

  const { id } = await params;

  // Fetch event
  const { data: eventData, error: eventError } = await supabase
    .from('rlc_events')
    .select('id, title, charter_id')
    .eq('id', id)
    .single();

  if (eventError || !eventData) notFound();

  const event = eventData as { id: string; title: string; charter_id: string | null };

  // Check charter visibility
  if (event.charter_id && ctx.visibleCharterIds !== null) {
    if (!ctx.visibleCharterIds.includes(event.charter_id)) {
      redirect('/admin/events?error=forbidden');
    }
  }

  const { data: registrations, error: regError } = await supabase
    .from('rlc_event_registrations')
    .select(`
      id, contact_id, guest_email, guest_name, registration_status, checked_in_at, created_at,
      member:rlc_contacts(first_name, last_name, email)
    `)
    .eq('event_id', id)
    .order('created_at', { ascending: false });

  if (regError) {
    throw new Error(`Failed to fetch registrations: ${regError.message}`);
  }

  const rows = (registrations || []) as RegistrationRow[];

  const statusColors: Record<string, string> = {
    registered: 'bg-blue-100 text-blue-800',
    checked_in: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <div>
      <div className="mb-8">
        <Link href={`/admin/events/${id}`} className="text-sm text-muted-foreground hover:underline">
          &larr; Back to {event.title}
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Registrations</h1>
        <p className="mt-2 text-muted-foreground">
          {rows.length} registration{rows.length !== 1 ? 's' : ''} for {event.title}
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Checked In</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Registered</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((reg) => (
                <tr key={reg.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-sm font-medium">
                    {reg.member
                      ? `${reg.member.first_name} ${reg.member.last_name}`
                      : reg.guest_name || 'Unknown'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {reg.member?.email || reg.guest_email || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {reg.contact_id ? 'Member' : 'Guest'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${statusColors[reg.registration_status] || 'bg-gray-100'}`}>
                      {reg.registration_status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {reg.checked_in_at ? formatDate(reg.checked_in_at) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(reg.created_at)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No registrations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
