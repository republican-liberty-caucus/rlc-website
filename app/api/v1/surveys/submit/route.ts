import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { surveySubmissionSchema } from '@/lib/validations/survey';
import { findOrCreateCandidateContact } from '@/lib/vetting/candidate-contact';
import { applyRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

export async function POST(request: Request) {
  const rateLimited = applyRateLimit(request, 'public');
  if (rateLimited) return rateLimited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
  }

  const token = (body as Record<string, unknown>)?.accessToken;
  if (!token || typeof token !== 'string') {
    return apiError('Access token required', ApiErrorCode.VALIDATION_ERROR, 400);
  }

  const parseResult = surveySubmissionSchema.safeParse(body);
  if (!parseResult.success) {
    return validationError(parseResult.error);
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
    return apiError('Invalid access token', ApiErrorCode.NOT_FOUND, 404);
  }

  const candidateResponse = responseData as {
    id: string; survey_id: string; status: string; token_expires_at: string | null;
  };

  // Check token expiration (issue #55)
  if (candidateResponse.token_expires_at && new Date(candidateResponse.token_expires_at) < new Date()) {
    return apiError('Survey link has expired', ApiErrorCode.VALIDATION_ERROR, 410);
  }

  if (candidateResponse.status === 'submitted') {
    return apiError('Survey already submitted', ApiErrorCode.CONFLICT, 409);
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
    return apiError('Failed to save answers', ApiErrorCode.INTERNAL_ERROR, 500);
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

  // Link candidate to contact record (non-blocking)
  try {
    const { data: candidateInfo } = await supabase
      .from('rlc_candidate_responses')
      .select('contact_id, candidate_first_name, candidate_last_name, candidate_email, candidate_state')
      .eq('id', candidateResponse.id)
      .single();

    if (candidateInfo && !(candidateInfo as { contact_id: string | null }).contact_id) {
      const ci = candidateInfo as { candidate_first_name: string; candidate_last_name: string; candidate_email: string | null; candidate_state: string | null };
      const { contactId } = await findOrCreateCandidateContact({
        candidateFirstName: ci.candidate_first_name,
        candidateLastName: ci.candidate_last_name,
        candidateEmail: ci.candidate_email,
        candidateState: ci.candidate_state,
      });

      await supabase
        .from('rlc_candidate_responses')
        .update({ contact_id: contactId } as never)
        .eq('id', candidateResponse.id);
    }
  } catch (err) {
    logger.error('Failed to link submitted candidate to contact (non-blocking):', err);
  }

  return NextResponse.json({
    message: 'Survey submitted successfully',
    score: finalScore,
  });
}
