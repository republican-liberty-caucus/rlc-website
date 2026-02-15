import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getMemberByClerkId } from '@/lib/supabase/server';
import { getOrCreateShareLink, buildTrackedUrl } from '@/lib/share/tracking';
import { shareLinkCreateSchema } from '@/lib/validations/share-kit';
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

    const parseResult = shareLinkCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten() },
        { status: 400 },
      );
    }

    const link = await getOrCreateShareLink(parseResult.data.shareKitId, member.id);
    if (!link) {
      return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
    }

    return NextResponse.json({
      shareLink: {
        ...link,
        url: buildTrackedUrl(link.short_code),
      },
    });
  } catch (err) {
    logger.error('Unhandled error in share-links POST:', { error: err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
