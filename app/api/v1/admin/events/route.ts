import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { eventCreateSchema } from '@/lib/validations/event';
import crypto from 'crypto';

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = eventCreateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const input = parseResult.data;

  // Scoped admins can only create events for their visible chapters
  if (input.chapterId && ctx.visibleChapterIds !== null) {
    if (!ctx.visibleChapterIds.includes(input.chapterId)) {
      return NextResponse.json(
        { error: 'Cannot create event for a chapter outside your scope' },
        { status: 403 }
      );
    }
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('rlc_events')
    .insert({
      id: crypto.randomUUID(),
      title: input.title,
      slug: input.slug,
      description: input.description || null,
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
      chapter_id: input.chapterId || null,
      organizer_id: ctx.member.id,
      status: input.status,
      metadata: {},
      updated_at: new Date().toISOString(),
    } as never)
    .select()
    .single();

  if (error) {
    console.error('Error creating event:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }

  return NextResponse.json({ event: data }, { status: 201 });
}
