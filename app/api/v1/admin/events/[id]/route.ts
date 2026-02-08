import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { eventUpdateSchema } from '@/lib/validations/event';
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

  // Fetch existing event
  const { data: existingData, error: fetchError } = await supabase
    .from('rlc_events')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existingData) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const existing = existingData as { chapter_id: string | null; [key: string]: unknown };

  // Check chapter visibility
  if (existing.chapter_id && ctx.visibleChapterIds !== null) {
    if (!ctx.visibleChapterIds.includes(existing.chapter_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = eventUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const input = parseResult.data;

  // If changing chapter, verify new chapter is in scope
  if (input.chapterId !== undefined && ctx.visibleChapterIds !== null) {
    if (input.chapterId && !ctx.visibleChapterIds.includes(input.chapterId)) {
      return NextResponse.json(
        { error: 'Cannot move event to a chapter outside your scope' },
        { status: 403 }
      );
    }
  }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) updatePayload.title = input.title;
  if (input.slug !== undefined) updatePayload.slug = input.slug;
  if (input.description !== undefined) updatePayload.description = input.description || null;
  if (input.eventType !== undefined) updatePayload.event_type = input.eventType || null;
  if (input.startDate !== undefined) updatePayload.start_date = input.startDate.toISOString();
  if (input.endDate !== undefined) updatePayload.end_date = input.endDate?.toISOString() || null;
  if (input.timezone !== undefined) updatePayload.timezone = input.timezone;
  if (input.isVirtual !== undefined) updatePayload.is_virtual = input.isVirtual;
  if (input.locationName !== undefined) updatePayload.location_name = input.locationName || null;
  if (input.address !== undefined) updatePayload.address = input.address || null;
  if (input.city !== undefined) updatePayload.city = input.city || null;
  if (input.state !== undefined) updatePayload.state = input.state || null;
  if (input.postalCode !== undefined) updatePayload.postal_code = input.postalCode || null;
  if (input.virtualUrl !== undefined) updatePayload.virtual_url = input.virtualUrl || null;
  if (input.registrationRequired !== undefined) updatePayload.registration_required = input.registrationRequired;
  if (input.maxAttendees !== undefined) updatePayload.max_attendees = input.maxAttendees || null;
  if (input.registrationFee !== undefined) updatePayload.registration_fee = input.registrationFee || null;
  if (input.registrationDeadline !== undefined) updatePayload.registration_deadline = input.registrationDeadline?.toISOString() || null;
  if (input.chapterId !== undefined) updatePayload.chapter_id = input.chapterId || null;
  if (input.status !== undefined) updatePayload.status = input.status;

  const { data, error } = await supabase
    .from('rlc_events')
    .update(updatePayload as never)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Error updating event:', error);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }

  return NextResponse.json({ event: data });
}
