import { NextResponse } from 'next/server';
import { eventCreateSchema } from '@/lib/validations/event';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

export async function POST(request: Request) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
  }

  const parseResult = eventCreateSchema.safeParse(body);
  if (!parseResult.success) {
    return validationError(parseResult.error);
  }

  const input = parseResult.data;

  // Scoped admins can only create events for their visible charters
  if (input.charterId && ctx.visibleCharterIds !== null) {
    if (!ctx.visibleCharterIds.includes(input.charterId)) {
      return apiError('Cannot create event for a charter outside your scope', ApiErrorCode.FORBIDDEN, 403);
    }
  }

  const { data, error } = await supabase
    .from('rlc_events')
    .insert({
      id: crypto.randomUUID(),
      title: input.title,
      slug: input.slug,
      description: input.description || null,
      featured_image_url: input.featuredImageUrl || null,
      event_type: input.eventType || null,
      start_date: input.startDate.toISOString(),
      end_date: input.endDate?.toISOString() || null,
      timezone: input.timezone,
      is_virtual: input.isVirtual,
      location_name: input.locationName || null,
      address: input.address || null,
      city: input.city || null,
      state: input.state || null,
      postal_code: input.postalCode || null,
      virtual_url: input.virtualUrl || null,
      registration_required: input.registrationRequired,
      max_attendees: input.maxAttendees || null,
      registration_fee: input.registrationFee || null,
      registration_deadline: input.registrationDeadline?.toISOString() || null,
      charter_id: input.charterId || null,
      organizer_id: input.organizerId || ctx.member.id,
      status: input.status,
      metadata: {},
      updated_at: new Date().toISOString(),
    } as never)
    .select()
    .single();

  if (error) {
    logger.error('Error creating event:', error);
    return apiError('Failed to create event', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  return NextResponse.json({ event: data }, { status: 201 });
}
