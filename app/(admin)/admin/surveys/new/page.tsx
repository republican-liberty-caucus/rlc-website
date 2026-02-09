import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { SurveyForm } from '@/components/admin/survey-form';

export const metadata: Metadata = {
  title: 'Create Survey - Admin',
};

export default async function AdminCreateSurveyPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const supabase = createServerClient();
  let chartersQuery = supabase.from('rlc_charters').select('id, name').eq('status', 'active').order('name');
  if (ctx.visibleCharterIds !== null && ctx.visibleCharterIds.length > 0) {
    chartersQuery = chartersQuery.in('id', ctx.visibleCharterIds);
  }
  const { data: charters } = await chartersQuery;

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/surveys" className="text-sm text-muted-foreground hover:underline">
          &larr; Back to Surveys
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Create Survey</h1>
      </div>
      <SurveyForm charters={(charters || []) as { id: string; name: string }[]} />
    </div>
  );
}
