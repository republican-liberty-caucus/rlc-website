import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/admin/permissions';
import { ScorecardSessionForm } from '@/components/admin/scorecard-session-form';

export const metadata: Metadata = {
  title: 'New Scorecard Session - Admin',
  description: 'Create a new Liberty Scorecard session',
};

export default async function NewScorecardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold">New Scorecard Session</h1>
      <ScorecardSessionForm />
    </div>
  );
}
