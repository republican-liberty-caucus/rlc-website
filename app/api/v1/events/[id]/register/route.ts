import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient, getMemberByClerkId } from '@/lib/supabase/server';
import { eventRegistrationSchema } from '@/lib/validations/event';
import { applyRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = applyRateLimit(request, 'public');
  if (rateLimited) return rateLimited;

  const { id: eventId } = await params;
  const { userId } = await auth();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
  }

  // Override eventId from URL params
  const parseResult = eventRegistrationSchema.safeParse({ ...body as object, eventId });
  if (!parseResult.success) {
    return validationError(parseResult.error);
  }

  const input = parseResult.data;
  const supabase = createServerClient();

  // Fetch the event
  const { data: eventData, error: eventError } = await supabase
    .from('rlc_events')
    .select('id, status, registration_required, max_attendees, registration_deadline, registration_fee')
    .eq('id', eventId)
    .single();

  if (eventError || !eventData) {
    return apiError('Event not found', ApiErrorCode.NOT_FOUND, 404);
  }

  const event = eventData as {
    id: string; status: string; registration_required: boolean;
    max_attendees: number | null; registration_deadline: string | null;
    registration_fee: number | null;
  };

  if (event.status !== 'published') {
    return apiError('Event is not open for registration', ApiErrorCode.VALIDATION_ERROR, 400);
  }

  if (!event.registration_required) {
    return apiError('This event does not require registration', ApiErrorCode.VALIDATION_ERROR, 400);
  }

  // Check deadline
  if (event.registration_deadline && new Date(event.registration_deadline) < new Date()) {
    return apiError('Registration deadline has passed', ApiErrorCode.VALIDATION_ERROR, 400);
  }

  // Determine member vs guest
  let memberId: string | null = null;
  let guestEmail: string | null = null;
  let guestName: string | null = null;

  if (userId) {
    const member = await getMemberByClerkId(userId);
    if (member) {
      memberId = member.id;

      // Check duplicate
      const { data: existing } = await supabase
        .from('rlc_event_registrations')
        .select('id')
        .eq('event_id', eventId)
        .eq('contact_id', memberId)
        .in('registration_status', ['registered', 'checked_in'])
        .maybeSingle();

      if (existing) {
        return apiError('You are already registered for this event', ApiErrorCode.CONFLICT, 409);
      }
    }
  }

  if (!memberId) {
    // Guest registration
    if (!input.guestEmail || !input.guestName) {
      return apiError('Guest name and email are required', ApiErrorCode.VALIDATION_ERROR, 400);
    }
    guestEmail = input.guestEmail;
    guestName = input.guestName;

    // Check duplicate by guest email
    const { data: existingGuest } = await supabase
      .from('rlc_event_registrations')
      .select('id')
      .eq('event_id', eventId)
      .eq('guest_email', guestEmail)
      .in('registration_status', ['registered', 'checked_in'])
      .maybeSingle();

    if (existingGuest) {
      return apiError('This email is already registered for this event', ApiErrorCode.CONFLICT, 409);
    }
  }

  // Insert registration, then atomically verify capacity (issue #53).
  // Insert first, count after — if over capacity, delete and reject.
  // This prevents the TOCTOU race between a separate count + insert.
  const registrationId = crypto.randomUUID();
  const { data: registration, error: insertError } = await supabase
    .from('rlc_event_registrations')
    .insert({
      id: registrationId,
      event_id: eventId,
      contact_id: memberId,
      guest_email: guestEmail,
      guest_name: guestName,
      registration_status: 'registered',
      metadata: {},
    } as never)
    .select()
    .single();

  if (insertError) {
    logger.error('Error creating registration:', insertError);
    return apiError('Failed to register', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  // Post-insert capacity check: if max_attendees is set, verify we haven't exceeded it
  if (event.max_attendees) {
    const { count } = await supabase
      .from('rlc_event_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .in('registration_status', ['registered', 'checked_in']);

    if ((count || 0) > event.max_attendees) {
      // Over capacity — roll back this registration
      await supabase
        .from('rlc_event_registrations')
        .delete()
        .eq('id', registrationId);

      return apiError('This event is full', ApiErrorCode.CONFLICT, 409);
    }
  }

  return NextResponse.json({ registration }, { status: 201 });
}
