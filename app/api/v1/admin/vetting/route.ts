import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canCreateVetting } from '@/lib/vetting/permissions';
import { vettingCreateSchema } from '@/lib/validations/vetting';
import { initializeSectionStates } from '@/lib/vetting/engine';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

interface CandidateResponseRow {
  id: string;
  candidate_first_name: string;
  candidate_last_name: string;
  candidate_email: string | null;
  candidate_party: string | null;
  candidate_office: string | null;
  candidate_district: string | null;
  candidate_state: string | null;
  office_type_id: string | null;
  status: string;
  survey: { state: string | null; charter_id: string | null } | null;
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || !canCreateVetting(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parseResult = vettingCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { candidateResponseId, committeeId, electionDeadlineId } = parseResult.data;

    const supabase = createServerClient();

    // Look up the candidate response to denormalize fields and validate state
    const { data: response, error: responseError } = await supabase
      .from('rlc_candidate_responses')
      .select('id, candidate_first_name, candidate_last_name, candidate_email, candidate_party, candidate_office, candidate_district, candidate_state, office_type_id, status, survey:rlc_surveys(state, charter_id)')
      .eq('id', candidateResponseId)
      .single();

    if (responseError) {
      if (responseError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Candidate response not found' }, { status: 404 });
      }
      logger.error('Error fetching candidate response:', { candidateResponseId, error: responseError });
      return NextResponse.json({ error: 'Failed to look up candidate response' }, { status: 500 });
    }

    if (!response) {
      return NextResponse.json({ error: 'Candidate response not found' }, { status: 404 });
    }

    const candidateResponse = response as unknown as CandidateResponseRow;

    if (candidateResponse.status !== 'submitted') {
      return NextResponse.json(
        { error: 'Candidate response must be submitted before creating a vetting' },
        { status: 400 }
      );
    }

    // Prefer structured candidate_state from response, fall back to survey-level state
    const candidateState = candidateResponse.candidate_state ?? candidateResponse.survey?.state ?? null;
    const charterId = candidateResponse.survey?.charter_id ?? null;

    const vettingId = crypto.randomUUID();

    const { data: vetting, error: insertError } = await supabase
      .from('rlc_candidate_vettings')
      .insert({
        id: vettingId,
        candidate_response_id: candidateResponseId,
        committee_id: committeeId ?? null,
        election_deadline_id: electionDeadlineId ?? null,
        candidate_first_name: candidateResponse.candidate_first_name,
        candidate_last_name: candidateResponse.candidate_last_name,
        candidate_office: candidateResponse.candidate_office ?? null,
        candidate_district: candidateResponse.candidate_district ?? null,
        candidate_state: candidateState,
        candidate_party: candidateResponse.candidate_party ?? null,
        office_type_id: candidateResponse.office_type_id ?? null,
        charter_id: charterId,
        stage: 'survey_submitted',
      } as never)
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'A vetting already exists for this candidate response' },
          { status: 409 }
        );
      }
      logger.error('Error creating vetting:', { candidateResponseId, error: insertError });
      return NextResponse.json({ error: 'Failed to create vetting' }, { status: 500 });
    }

    // Initialize all 9 report sections as not_started
    const sectionStates = initializeSectionStates();
    const sectionRows = sectionStates.map((s) => ({
      id: crypto.randomUUID(),
      vetting_id: vettingId,
      section: s.section,
      status: s.status,
      data: null,
      ai_draft_data: null,
      notes: null,
    }));

    const { error: sectionsError } = await supabase
      .from('rlc_candidate_vetting_report_sections')
      .insert(sectionRows as never);

    if (sectionsError) {
      // Sections are structurally required — roll back the vetting and fail
      logger.error('Error creating report sections, deleting orphaned vetting:', {
        vettingId,
        error: sectionsError,
      });
      await supabase.from('rlc_candidate_vettings').delete().eq('id', vettingId);
      return NextResponse.json(
        { error: 'Failed to initialize report sections. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ vetting }, { status: 201 });
  } catch (err) {
    logger.error('Unhandled error in POST /api/v1/admin/vetting:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
