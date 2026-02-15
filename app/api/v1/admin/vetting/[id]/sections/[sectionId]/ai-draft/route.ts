import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canEditSection } from '@/lib/vetting/permissions';
import { aiDraftGenerateSchema } from '@/lib/validations/vetting';
import { SECTIONS_WITH_AI_HELPER } from '@/lib/ai/vetting/types';
import { researchOpponent } from '@/lib/ai/vetting/research-opponent';
import { researchDistrict } from '@/lib/ai/vetting/research-district';
import { researchVotingRules } from '@/lib/ai/vetting/research-voting-rules';
import { draftCandidateBackground } from '@/lib/ai/vetting/draft-candidate-background';
import { generateExecutiveSummary } from '@/lib/ai/vetting/generate-executive-summary';
import { logger } from '@/lib/logger';
import type { VettingReportSectionType } from '@/types';

type RouteParams = { params: Promise<{ id: string; sectionId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await getVettingContext(userId);
    if (!ctx) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, sectionId } = await params;
    const supabase = createServerClient();

    // Parse body for force flag
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine — defaults apply
    }

    const parseResult = aiDraftGenerateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { force } = parseResult.data;

    // Fetch section with assignments
    interface SectionRow {
      id: string;
      vetting_id: string;
      section: VettingReportSectionType;
      ai_draft_data: Record<string, unknown> | null;
      assignments: { committee_member_id: string }[];
    }

    const { data: rawSection, error: fetchError } = await supabase
      .from('rlc_candidate_vetting_report_sections')
      .select(`
        id, vetting_id, section, ai_draft_data,
        assignments:rlc_candidate_vetting_section_assignments(committee_member_id)
      `)
      .eq('id', sectionId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Section not found' }, { status: 404 });
      }
      logger.error('Error fetching section for AI draft:', { sectionId, error: fetchError });
      return NextResponse.json({ error: 'Failed to fetch section' }, { status: 500 });
    }

    const section = rawSection as unknown as SectionRow;

    if (section.vetting_id !== id) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    // Permission check
    const assignedMemberIds = (section.assignments ?? []).map((a) => a.committee_member_id);
    if (!canEditSection(ctx, assignedMemberIds)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if AI helper exists for this section type
    if (!SECTIONS_WITH_AI_HELPER.includes(section.section)) {
      return NextResponse.json(
        { error: 'No AI helper available for this section type' },
        { status: 400 }
      );
    }

    // Guard against accidental overwrites
    if (section.ai_draft_data && !force) {
      return NextResponse.json(
        { error: 'AI draft already exists. Pass force: true to regenerate.' },
        { status: 409 }
      );
    }

    // Load vetting data for context
    interface VettingRow {
      id: string;
      candidate_first_name: string;
      candidate_last_name: string;
      candidate_state: string | null;
      candidate_office: string | null;
      candidate_district: string | null;
      candidate_party: string | null;
    }

    const { data: rawVetting, error: vettingError } = await supabase
      .from('rlc_candidate_vettings')
      .select('id, candidate_first_name, candidate_last_name, candidate_state, candidate_office, candidate_district, candidate_party')
      .eq('id', id)
      .single();

    if (vettingError || !rawVetting) {
      logger.error('Error fetching vetting for AI draft:', { id, error: vettingError });
      return NextResponse.json({ error: 'Failed to fetch vetting data' }, { status: 500 });
    }

    const vetting = rawVetting as unknown as VettingRow;

    // Route to correct AI helper
    let aiDraftData: Record<string, unknown>;

    switch (section.section) {
      case 'opponent_research': {
        // Load opponents for this vetting
        const { data: opponents } = await supabase
          .from('rlc_candidate_vetting_opponents')
          .select('name, party')
          .eq('vetting_id', id)
          .limit(1);

        const opponent = opponents?.[0] as { name: string; party: string | null } | undefined;
        if (!opponent || !opponent.name?.trim()) {
          return NextResponse.json(
            { error: 'No opponents added to this vetting yet. Add an opponent with a name before generating research.' },
            { status: 400 }
          );
        }

        aiDraftData = await researchOpponent({
          opponentName: opponent.name,
          party: opponent.party,
          state: vetting.candidate_state,
          office: vetting.candidate_office,
          district: vetting.candidate_district,
        }) as unknown as Record<string, unknown>;
        break;
      }

      case 'district_data': {
        if (!vetting.candidate_state) {
          return NextResponse.json(
            { error: 'Candidate state is required for district research' },
            { status: 400 }
          );
        }

        aiDraftData = await researchDistrict({
          stateCode: vetting.candidate_state,
          districtId: vetting.candidate_district || 'At-Large',
          officeType: vetting.candidate_office || 'Unknown',
        }) as unknown as Record<string, unknown>;
        break;
      }

      case 'voting_rules': {
        if (!vetting.candidate_state) {
          return NextResponse.json(
            { error: 'Candidate state is required for voting rules research' },
            { status: 400 }
          );
        }

        aiDraftData = await researchVotingRules({
          stateCode: vetting.candidate_state,
        }) as unknown as Record<string, unknown>;
        break;
      }

      case 'candidate_background': {
        // Optionally load survey answers for context
        interface SurveyAnswer {
          answer: string;
          question: { question_text: string };
        }

        const { data: rawResponse } = await supabase
          .from('rlc_candidate_vettings')
          .select(`
            candidate_response:rlc_candidate_survey_responses!candidate_response_id(
              answers:rlc_candidate_survey_answers(
                answer,
                question:rlc_candidate_survey_questions(question_text)
              )
            )
          `)
          .eq('id', id)
          .single();

        const response = rawResponse as unknown as {
          candidate_response: { answers: SurveyAnswer[] } | null;
        } | null;

        const surveyAnswers = response?.candidate_response?.answers?.map((a) => ({
          question: a.question?.question_text || '',
          answer: a.answer || '',
        }));

        aiDraftData = await draftCandidateBackground({
          candidateFirstName: vetting.candidate_first_name,
          candidateLastName: vetting.candidate_last_name,
          office: vetting.candidate_office,
          state: vetting.candidate_state,
          district: vetting.candidate_district,
          party: vetting.candidate_party,
          surveyAnswers,
        }) as unknown as Record<string, unknown>;
        break;
      }

      case 'executive_summary': {
        // Load all other sections' data
        const { data: allSections } = await supabase
          .from('rlc_candidate_vetting_report_sections')
          .select('section, data, ai_draft_data')
          .eq('vetting_id', id);

        const sectionDataMap: Record<string, Record<string, unknown> | null> = {};
        for (const s of (allSections || []) as { section: string; data: Record<string, unknown> | null; ai_draft_data: Record<string, unknown> | null }[]) {
          // Prefer reviewed data, fall back to AI draft
          sectionDataMap[s.section] = s.data || s.ai_draft_data;
        }

        aiDraftData = await generateExecutiveSummary({
          candidateFirstName: vetting.candidate_first_name,
          candidateLastName: vetting.candidate_last_name,
          office: vetting.candidate_office,
          state: vetting.candidate_state,
          party: vetting.candidate_party,
          allSectionData: sectionDataMap,
        }) as unknown as Record<string, unknown>;
        break;
      }

      default:
        return NextResponse.json(
          { error: 'No AI helper available for this section type' },
          { status: 400 }
        );
    }

    // Store the AI draft
    const { data: updated, error: updateError } = await supabase
      .from('rlc_candidate_vetting_report_sections')
      .update({ ai_draft_data: aiDraftData } as never)
      .eq('id', sectionId)
      .eq('vetting_id', id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error storing AI draft:', { sectionId, error: updateError });
      return NextResponse.json({ error: 'Failed to store AI draft' }, { status: 500 });
    }

    return NextResponse.json({ section: updated });
  } catch (err) {
    logger.error('Unhandled error in POST ai-draft:', err);

    if (err instanceof Error && err.message.includes('ANTHROPIC_API_KEY')) {
      return NextResponse.json(
        { error: 'AI service is not configured. Contact an administrator.' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
