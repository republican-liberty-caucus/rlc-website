import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVettingContext, canEditSection, canViewPipeline } from '@/lib/vetting/permissions';
import { sectionUpdateSchema } from '@/lib/validations/vetting';
import { isValidSectionTransition } from '@/lib/vetting/engine';
import { logger } from '@/lib/logger';
import type { VettingSectionStatus } from '@/types';

type RouteParams = { params: Promise<{ id: string; sectionId: string }> };

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

    const { id, sectionId } = await params;
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('rlc_candidate_vetting_report_sections')
      .select(`
        *,
        assignments:rlc_candidate_vetting_section_assignments(
          *,
          committee_member:rlc_candidate_vetting_committee_members(
            id, role, contact:rlc_members(id, first_name, last_name, email)
          )
        )
      `)
      .eq('id', sectionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Section not found' }, { status: 404 });
      }
      logger.error('Error fetching section:', { sectionId, error });
      return NextResponse.json({ error: 'Failed to fetch section' }, { status: 500 });
    }

    const sectionData = data as unknown as { vetting_id: string; [key: string]: unknown };

    // Prevent cross-vetting access
    if (sectionData.vetting_id !== id) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    return NextResponse.json({ section: data });
  } catch (err) {
    logger.error('Unhandled error in GET sections/[sectionId]:', err);
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

    const { id, sectionId } = await params;
    const supabase = createServerClient();

    interface SectionWithAssignments {
      id: string;
      vetting_id: string;
      status: string;
      assignments: { committee_member_id: string }[];
    }

    // Fetch section with assignments to verify ownership and get current status
    const { data: rawSection, error: fetchError } = await supabase
      .from('rlc_candidate_vetting_report_sections')
      .select(`
        id, vetting_id, status,
        assignments:rlc_candidate_vetting_section_assignments(committee_member_id)
      `)
      .eq('id', sectionId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Section not found' }, { status: 404 });
      }
      logger.error('Error fetching section for update:', { sectionId, error: fetchError });
      return NextResponse.json({ error: 'Failed to fetch section' }, { status: 500 });
    }

    const section = rawSection as unknown as SectionWithAssignments;

    if (section.vetting_id !== id) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    const assignedMemberIds = (section.assignments ?? []).map((a) => a.committee_member_id);

    if (!canEditSection(ctx, assignedMemberIds)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parseResult = sectionUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    // Validate status transition if status is being changed
    if (parseResult.data.status) {
      if (!isValidSectionTransition(section.status as VettingSectionStatus, parseResult.data.status)) {
        return NextResponse.json(
          { error: `Invalid status transition from ${section.status} to ${parseResult.data.status}` },
          { status: 400 }
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (parseResult.data.data !== undefined) updates.data = parseResult.data.data;
    if (parseResult.data.status !== undefined) updates.status = parseResult.data.status;
    if (parseResult.data.notes !== undefined) updates.notes = parseResult.data.notes;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await supabase
      .from('rlc_candidate_vetting_report_sections')
      .update(updates as never)
      .eq('id', sectionId)
      .eq('vetting_id', id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating section:', { sectionId, error: updateError });
      return NextResponse.json({ error: 'Failed to update section' }, { status: 500 });
    }

    return NextResponse.json({ section: updated });
  } catch (err) {
    logger.error('Unhandled error in PATCH sections/[sectionId]:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
