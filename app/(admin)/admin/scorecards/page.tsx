import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Plus } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Scorecards - Admin',
  description: 'Manage Liberty Scorecard sessions',
};

interface SessionRow {
  id: string;
  name: string;
  slug: string;
  jurisdiction: string;
  state_code: string | null;
  session_year: number;
  status: string;
  created_at: string;
}

export default async function AdminScorecardsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const supabase = createServerClient();

  let query = supabase
    .from('rlc_scorecard_sessions')
    .select('id, name, slug, jurisdiction, state_code, session_year, status, created_at')
    .order('created_at', { ascending: false });

  if (ctx.visibleCharterIds !== null && ctx.visibleCharterIds.length > 0) {
    query = query.in('charter_id', ctx.visibleCharterIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch scorecard sessions: ${error.message}`);

  const sessions = (data || []) as SessionRow[];

  return (
    <div>
      <PageHeader
        title="Liberty Scorecards"
        count={sessions.length}
        className="mb-8"
        action={
          <Link href="/admin/scorecards/new">
            <Button className="bg-rlc-red hover:bg-rlc-red/90">
              <Plus className="mr-2 h-4 w-4" />
              New Session
            </Button>
          </Link>
        }
      />

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Jurisdiction</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Year</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-sm font-medium">{session.name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground capitalize">
                    {session.jurisdiction === 'federal' ? 'Federal' : session.state_code || 'State'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{session.session_year}</td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={session.status} type="scorecard" />
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(session.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/scorecards/${session.id}`}>
                      <Button variant="outline" size="sm">Manage</Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No scorecard sessions yet. Create one to start tracking legislator votes.
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
