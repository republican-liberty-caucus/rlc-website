import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { OnboardingWizard } from '@/components/admin/onboarding/onboarding-wizard';
import { ArrowLeft } from 'lucide-react';
import type { Chapter, ChapterOnboarding, ChapterOnboardingStep } from '@/types';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data } = await supabase.from('rlc_chapters').select('name').eq('id', id).single();
  const chapter = data as { name: string } | null;
  return { title: chapter ? `Onboarding — ${chapter.name}` : 'Onboarding' };
}

export default async function ChapterOnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const { id } = await params;
  const { step: activeStep } = await searchParams;

  if (ctx.visibleChapterIds !== null && !ctx.visibleChapterIds.includes(id)) {
    redirect('/admin/chapters?error=forbidden');
  }

  const supabase = createServerClient();

  const { data: chapterData, error: chapterError } = await supabase
    .from('rlc_chapters')
    .select('*')
    .eq('id', id)
    .single();

  if (chapterError || !chapterData) notFound();
  const chapter = chapterData as Chapter;

  if (chapter.status !== 'forming') {
    redirect(`/admin/chapters/${id}`);
  }

  // Fetch onboarding — use any cast since this is a new table not yet in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: onboardingData, error: onboardingError } = await (supabase as any)
    .from('rlc_chapter_onboarding')
    .select(`
      *,
      coordinator:rlc_members!rlc_chapter_onboarding_coordinator_id_fkey(id, first_name, last_name, email),
      steps:rlc_chapter_onboarding_steps(*)
    `)
    .eq('chapter_id', id)
    .single();

  // PGRST116 = no rows found (expected for chapters without onboarding)
  if (onboardingError && onboardingError.code !== 'PGRST116') {
    throw new Error(`Failed to load onboarding data: ${onboardingError.message}`);
  }

  const onboarding = onboardingData as (ChapterOnboarding & {
    coordinator: { id: string; first_name: string; last_name: string; email: string };
    steps: ChapterOnboardingStep[];
  }) | null;

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/admin/chapters/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Chapter
        </Link>
      </div>

      <OnboardingWizard
        chapterId={id}
        chapterName={chapter.name}
        onboarding={onboarding}
        activeStep={activeStep}
        isNational={ctx.isNational}
        currentMemberId={ctx.member.id}
      />
    </div>
  );
}
