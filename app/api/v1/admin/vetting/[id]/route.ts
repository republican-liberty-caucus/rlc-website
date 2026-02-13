import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  getVettingContext,
  canViewPipeline,
  canCreateVetting,
  canMakeRecommendation,
  canRecordInterview,
} from '@/lib/vetting/permissions';
import {
  vettingUpdateSchema,
  recommendationSchema,
  interviewUpdateSchema,
  pressReleaseUpdateSchema,
} from '@/lib/validations/vetting';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await getVettingContext(userId);
    if (!ctx || !canViewPipeline(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('rlc_candidate_vettings')
      .select(`
        *,
        election_deadline:rlc_candidate_election_deadlines(*),
        committee:rlc_candidate_vetting_committees(id, name),
        report_sections:rlc_candidate_vetting_report_sections(
          *,
          assignments:rlc_candidate_vetting_section_assignments(
            *,
            committee_member:rlc_candidate_vetting_committee_members(
              id, role, contact:rlc_members(id, first_name, last_name, email)
            )
          )
        ),
        opponents:rlc_candidate_vetting_opponents(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Vetting not found' }, { status: 404 });
      }
      logger.error('Error fetching vetting:', { id, error });
      return NextResponse.json({ error: 'Failed to fetch vetting' }, { status: 500 });
    }

    return NextResponse.json({ vetting: data });
  } catch (err) {
    logger.error('Unhandled error in GET /api/v1/admin/vetting/[id]:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await getVettingContext(userId);
    if (!ctx) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Detect which type of update based on body keys
    if ('recommendation' in body) {
      // Recommendation update
      if (!canMakeRecommendation(ctx)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const parseResult = recommendationSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: parseResult.error.flatten() },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('rlc_candidate_vettings')
        .update({
          recommendation: parseResult.data.recommendation,
          recommendation_notes: parseResult.data.notes ?? null,
          recommended_at: new Date().toISOString(),
        } as never)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json({ error: 'Vetting not found' }, { status: 404 });
        }
        logger.error('Error updating recommendation:', { id, error });
        return NextResponse.json({ error: 'Failed to update recommendation' }, { status: 500 });
      }

      return NextResponse.json({ vetting: data });
    }

    if ('interviewDate' in body || 'interviewNotes' in body || 'interviewers' in body) {
      // Interview update
      if (!canRecordInterview(ctx)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const parseResult = interviewUpdateSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: parseResult.error.flatten() },
          { status: 400 }
        );
      }

      const updates: Record<string, unknown> = {};
      if (parseResult.data.interviewDate !== undefined) {
        updates.interview_date = parseResult.data.interviewDate;
      }
      if (parseResult.data.interviewNotes !== undefined) {
        updates.interview_notes = parseResult.data.interviewNotes;
      }
      if (parseResult.data.interviewers !== undefined) {
        updates.interviewers = parseResult.data.interviewers;
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('rlc_candidate_vettings')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json({ error: 'Vetting not found' }, { status: 404 });
        }
        logger.error('Error updating interview:', { id, error });
        return NextResponse.json({ error: 'Failed to update interview' }, { status: 500 });
      }

      return NextResponse.json({ vetting: data });
    }

    // Press release update
    if ('pressReleaseUrl' in body || 'pressReleaseNotes' in body) {
      if (!canCreateVetting(ctx)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const parseResult = pressReleaseUpdateSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: parseResult.error.flatten() },
          { status: 400 }
        );
      }

      const updates: Record<string, unknown> = {};
      if (parseResult.data.pressReleaseUrl !== undefined) {
        updates.press_release_url = parseResult.data.pressReleaseUrl;
      }
      if (parseResult.data.pressReleaseNotes !== undefined) {
        updates.press_release_notes = parseResult.data.pressReleaseNotes;
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('rlc_candidate_vettings')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json({ error: 'Vetting not found' }, { status: 404 });
        }
        logger.error('Error updating press release:', { id, error });
        return NextResponse.json({ error: 'Failed to update press release' }, { status: 500 });
      }

      return NextResponse.json({ vetting: data });
    }

    // General vetting update
    if (!canCreateVetting(ctx)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parseResult = vettingUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (parseResult.data.committeeId !== undefined) {
      updates.committee_id = parseResult.data.committeeId;
    }
    if (parseResult.data.electionDeadlineId !== undefined) {
      updates.election_deadline_id = parseResult.data.electionDeadlineId;
    }
    if (parseResult.data.districtDataId !== undefined) {
      updates.district_data_id = parseResult.data.districtDataId;
    }
    if (parseResult.data.candidateState !== undefined) {
      updates.candidate_state = parseResult.data.candidateState;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('rlc_candidate_vettings')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Vetting not found' }, { status: 404 });
      }
      logger.error('Error updating vetting:', { id, error });
      return NextResponse.json({ error: 'Failed to update vetting' }, { status: 500 });
    }

    return NextResponse.json({ vetting: data });
  } catch (err) {
    logger.error('Unhandled error in PATCH /api/v1/admin/vetting/[id]:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
