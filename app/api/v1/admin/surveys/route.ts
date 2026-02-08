import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient, getMemberByClerkId } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { surveyCreateSchema } from '@/lib/validations/survey';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = surveyCreateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const input = parseResult.data;
  const supabase = createServerClient();

  // Get member for created_by
  const member = await getMemberByClerkId(userId);

  const surveyId = crypto.randomUUID();

  const { error: surveyError } = await supabase.from('rlc_surveys').insert({
    id: surveyId,
    title: input.title,
    slug: input.slug,
    description: input.description || null,
    status: 'draft',
    election_type: input.electionType || null,
    election_date: input.electionDate || null,
    state: input.state || null,
    chapter_id: input.chapterId || null,
    created_by: member?.id || null,
  } as never);

  if (surveyError) {
    if (surveyError.code === '23505') {
      return NextResponse.json({ error: 'A survey with this slug already exists' }, { status: 409 });
    }
    logger.error('Error creating survey:', surveyError);
    return NextResponse.json({ error: 'Failed to create survey' }, { status: 500 });
  }

  // Insert questions
  const questions = input.questions.map((q, i) => ({
    id: crypto.randomUUID(),
    survey_id: surveyId,
    question_text: q.questionText,
    question_type: q.questionType,
    options: q.options,
    weight: q.weight,
    sort_order: q.sortOrder || i,
    ideal_answer: q.idealAnswer || null,
  }));

  const { error: questionsError } = await supabase
    .from('rlc_survey_questions')
    .insert(questions as never[]);

  if (questionsError) {
    logger.error('Error creating survey questions:', questionsError);
    return NextResponse.json({ error: 'Survey created but questions failed' }, { status: 500 });
  }

  return NextResponse.json({ survey: { id: surveyId, slug: input.slug } }, { status: 201 });
}
