import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { surveySubmissionSchema } from '@/lib/validations/survey';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const token = (body as Record<string, unknown>)?.accessToken;
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Access token required' }, { status: 400 });
  }

  const parseResult = surveySubmissionSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { answers } = parseResult.data;
  const supabase = createServerClient();

  // Find candidate response by access token
  const { data: responseData, error: responseError } = await supabase
    .from('rlc_candidate_responses')
    .select('id, survey_id, status, token_expires_at')
    .eq('access_token', token)
    .single();

  if (responseError || !responseData) {
    return NextResponse.json({ error: 'Invalid access token' }, { status: 404 });
  }

  const candidateResponse = responseData as {
    id: string; survey_id: string; status: string; token_expires_at: string | null;
  };

  // Check token expiration (issue #55)
  if (candidateResponse.token_expires_at && new Date(candidateResponse.token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Survey link has expired' }, { status: 410 });
  }

  if (candidateResponse.status === 'submitted') {
    return NextResponse.json({ error: 'Survey already submitted' }, { status: 409 });
  }

  // Fetch questions for scoring
  const { data: questionsData } = await supabase
    .from('rlc_survey_questions')
    .select('id, question_type, weight, ideal_answer')
    .eq('survey_id', candidateResponse.survey_id);

  const questions = (questionsData || []) as {
    id: string; question_type: string; weight: number; ideal_answer: string | null;
  }[];

  const questionMap = new Map(questions.map(q => [q.id, q]));

  // Score and insert answers
  let totalScore = 0;
  let totalWeight = 0;

  const answerRows = answers.map(a => {
    const q = questionMap.get(a.questionId);
    let score: number | null = null;

    if (q && q.ideal_answer) {
      totalWeight += q.weight;

      if (q.question_type === 'scale') {
        // Score 0-100 based on how close to ideal (both 1-5 scale)
        const ideal = parseInt(q.ideal_answer, 10);
        const actual = parseInt(a.answer, 10);
        if (!isNaN(ideal) && !isNaN(actual)) {
          score = Math.max(0, (1 - Math.abs(ideal - actual) / 4)) * 100;
          totalScore += score * q.weight;
        }
      } else if (q.question_type === 'yes_no') {
        score = a.answer.toLowerCase() === q.ideal_answer.toLowerCase() ? 100 : 0;
        totalScore += score * q.weight;
      }
    }

    return {
      id: crypto.randomUUID(),
      candidate_response_id: candidateResponse.id,
      question_id: a.questionId,
      answer: a.answer,
      score,
    };
  });

  const { error: answersError } = await supabase
    .from('rlc_survey_answers')
    .insert(answerRows as never[]);

  if (answersError) {
    logger.error('Error saving answers:', answersError);
    return NextResponse.json({ error: 'Failed to save answers' }, { status: 500 });
  }

  // Calculate weighted score
  const finalScore = totalWeight > 0
    ? Math.round((totalScore / totalWeight) * 100) / 100
    : null;

  // Update candidate response status
  const { error: updateError } = await supabase
    .from('rlc_candidate_responses')
    .update({
      status: 'submitted',
      total_score: finalScore,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', candidateResponse.id);

  if (updateError) {
    logger.error('Error updating candidate response:', updateError);
  }

  return NextResponse.json({
    message: 'Survey submitted successfully',
    score: finalScore,
  });
}
