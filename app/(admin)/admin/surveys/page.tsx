import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Surveys - Admin',
  description: 'Manage candidate endorsement surveys',
};

interface SurveyRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  election_type: string | null;
  state: string | null;
  created_at: string;
}

export default async function AdminSurveysPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const supabase = createServerClient();

  let query = supabase
    .from('rlc_surveys')
    .select('id, title, slug, status, election_type, state, created_at')
    .order('created_at', { ascending: false });

  if (ctx.visibleChapterIds !== null && ctx.visibleChapterIds.length > 0) {
    query = query.in('chapter_id', ctx.visibleChapterIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch surveys: ${error.message}`);

  const surveys = (data || []) as SurveyRow[];

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    active: 'bg-green-100 text-green-800',
    closed: 'bg-red-100 text-red-800',
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Candidate Surveys</h1>
          <p className="mt-2 text-muted-foreground">{surveys.length} surveys</p>
        </div>
        <Link href="/admin/surveys/new">
          <Button className="bg-rlc-red hover:bg-rlc-red/90">
            <Plus className="mr-2 h-4 w-4" />
            Create Survey
          </Button>
        </Link>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Election</th>
                <th className="px-4 py-3 text-left text-sm font-medium">State</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {surveys.map((survey) => (
                <tr key={survey.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-sm font-medium">{survey.title}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground capitalize">
                    {survey.election_type || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {survey.state || 'National'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${statusColors[survey.status] || 'bg-gray-100'}`}>
                      {survey.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(survey.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/surveys/${survey.id}`}>
                      <Button variant="outline" size="sm">Manage</Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {surveys.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No surveys yet. Create your first candidate survey to get started.
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
