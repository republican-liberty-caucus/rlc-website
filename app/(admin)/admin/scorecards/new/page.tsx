import { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin/route-helpers';
import { ScorecardSessionForm } from '@/components/admin/scorecard-session-form';

export const metadata: Metadata = {
  title: 'New Scorecard Session - Admin',
  description: 'Create a new Liberty Scorecard session',
};

export default async function NewScorecardPage() {
  await requireAdmin();

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold">New Scorecard Session</h1>
      <ScorecardSessionForm />
    </div>
  );
}
