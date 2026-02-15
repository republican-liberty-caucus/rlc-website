import { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/route-helpers';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
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
  const { ctx, supabase } = await requireAdmin();

  let query = supabase
    .from('rlc_surveys')
    .select('id, title, slug, status, election_type, state, created_at')
    .order('created_at', { ascending: false });

  if (ctx.visibleCharterIds !== null && ctx.visibleCharterIds.length > 0) {
    query = query.in('charter_id', ctx.visibleCharterIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch surveys: ${error.message}`);

  const surveys = (data || []) as SurveyRow[];

  return (
    <div>
      <PageHeader
        title="Candidate Surveys"
        count={surveys.length}
        className="mb-8"
        action={
          <Link href="/admin/surveys/new">
            <Button className="bg-rlc-red hover:bg-rlc-red/90">
              <Plus className="mr-2 h-4 w-4" />
              Create Survey
            </Button>
          </Link>
        }
      />

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
                    <StatusBadge status={survey.status} type="survey" />
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
