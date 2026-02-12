import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { surveyUpdateSchema } from '@/lib/validations/survey';
import { logger } from '@/lib/logger';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createServerClient();

  const { data: existingData, error: fetchError } = await supabase
    .from('rlc_surveys')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existingData) {
    return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = surveyUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const input = parseResult.data;
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.title !== undefined) updatePayload.title = input.title;
  if (input.slug !== undefined) updatePayload.slug = input.slug;
  if (input.description !== undefined) updatePayload.description = input.description || null;
  if (input.status !== undefined) updatePayload.status = input.status;
  if (input.electionType !== undefined) updatePayload.election_type = input.electionType || null;
  if (input.primaryDate !== undefined) updatePayload.primary_date = input.primaryDate || null;
  if (input.generalDate !== undefined) updatePayload.general_date = input.generalDate || null;
  if (input.state !== undefined) updatePayload.state = input.state || null;
  if (input.charterId !== undefined) updatePayload.charter_id = input.charterId || null;
  if (input.officeTypeId !== undefined) updatePayload.office_type_id = input.officeTypeId || null;
  if (input.electionDeadlineId !== undefined) updatePayload.election_deadline_id = input.electionDeadlineId || null;

  const { data, error } = await supabase
    .from('rlc_surveys')
    .update(updatePayload as never)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Error updating survey:', error);
    return NextResponse.json({ error: 'Failed to update survey' }, { status: 500 });
  }

  return NextResponse.json({ survey: data });
}
