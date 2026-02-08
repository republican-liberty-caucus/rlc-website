import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { chapterUpdateSchema } from '@/lib/validations/admin';
import type { Database } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

type ChapterUpdate = Database['public']['Tables']['rlc_chapters']['Update'];

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

  // Check chapter visibility
  if (ctx.visibleChapterIds !== null && !ctx.visibleChapterIds.includes(id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const parseResult = chapterUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const input = parseResult.data;

  const updatePayload: ChapterUpdate = {};
  if (input.name !== undefined) updatePayload.name = input.name;
  if (input.contactEmail !== undefined) updatePayload.contact_email = input.contactEmail;
  if (input.websiteUrl !== undefined) updatePayload.website_url = input.websiteUrl;
  if (input.status !== undefined) updatePayload.status = input.status;

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('rlc_chapters')
    .update(updatePayload as never)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Error updating chapter:', error);
    return NextResponse.json({ error: 'Failed to update chapter' }, { status: 500 });
  }

  return NextResponse.json({ chapter: data });
}
