import { NextResponse } from 'next/server';
import { eventUpdateSchema } from '@/lib/validations/event';
import { logger } from '@/lib/logger';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  const { id } = await params;

  // Fetch existing event
  const { data: existingData, error: fetchError } = await supabase
    .from('rlc_events')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existingData) {
    return apiError('Event not found', ApiErrorCode.NOT_FOUND, 404);
  }

  const existing = existingData as { charter_id: string | null; [key: string]: unknown };

  // Check charter visibility
  if (existing.charter_id && ctx.visibleCharterIds !== null) {
    if (!ctx.visibleCharterIds.includes(existing.charter_id)) {
      return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
  }

  const parseResult = eventUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return validationError(parseResult.error);
  }

  const input = parseResult.data;

  // If changing charter, verify new charter is in scope
  if (input.charterId !== undefined && ctx.visibleCharterIds !== null) {
    if (input.charterId && !ctx.visibleCharterIds.includes(input.charterId)) {
      return apiError('Cannot move event to a charter outside your scope', ApiErrorCode.FORBIDDEN, 403);
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
  if (input.featuredImageUrl !== undefined) updatePayload.featured_image_url = input.featuredImageUrl || null;
  if (input.charterId !== undefined) updatePayload.charter_id = input.charterId || null;
  if (input.organizerId !== undefined) updatePayload.organizer_id = input.organizerId || null;
  if (input.status !== undefined) updatePayload.status = input.status;

  const { data, error } = await supabase
    .from('rlc_events')
    .update(updatePayload as never)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Error updating event:', error);
    return apiError('Failed to update event', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ event: data });
}
