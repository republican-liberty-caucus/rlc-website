import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { surveyCreateSchema } from '@/lib/validations/survey';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

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

  const surveyId = crypto.randomUUID();

  const { error: surveyError } = await supabase.from('rlc_surveys').insert({
    id: surveyId,
    title: input.title,
    slug: input.slug,
    description: input.description || null,
    status: 'draft',
    office_type_id: input.officeTypeId || null,
    election_type: input.electionType || null,
    primary_date: input.primaryDate || null,
    general_date: input.generalDate || null,
    state: input.state || null,
    charter_id: input.charterId || null,
    election_deadline_id: input.electionDeadlineId || null,
    created_by: ctx.member.id,
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
