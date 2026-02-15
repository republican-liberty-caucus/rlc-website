import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient, getMemberByClerkId } from '@/lib/supabase/server';
import { shareEventCreateSchema } from '@/lib/validations/share-kit';
import { getOrCreateShareLink } from '@/lib/share/tracking';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const member = await getMemberByClerkId(userId);
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parseResult = shareEventCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 },
      );
    }

    const { shareKitId, platform } = parseResult.data;

    const link = await getOrCreateShareLink(shareKitId, member.id);
    if (!link) {
      return NextResponse.json({ error: 'Failed to resolve share link' }, { status: 500 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from('rlc_share_events')
      .insert({
        share_link_id: link.id,
        platform,
      } as never);

    if (error) {
      logger.error('Failed to record share event:', { shareLinkId: link.id, platform, error });
      return NextResponse.json({ error: 'Failed to record share event' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('Unhandled error in share-events POST:', { error: err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
