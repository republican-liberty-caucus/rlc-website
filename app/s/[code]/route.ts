import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { resolveDestinationUrl, recordClick } from '@/lib/share/tracking';
import { BASE_URL } from '@/lib/constants';
import { logger } from '@/lib/logger';

const SHORT_CODE_RE = /^[A-Za-z0-9_-]{6,12}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    // Validate short code format to avoid unnecessary DB queries from bots
    if (!SHORT_CODE_RE.test(code)) {
      return NextResponse.redirect(`${BASE_URL}/`, { status: 302 });
    }

    const supabase = createServerClient();

    const { data: rawLink, error: linkError } = await supabase
      .from('rlc_share_links')
      .select('id, share_kit_id, share_kit:rlc_share_kits!share_kit_id(content_type, content_id)')
      .eq('short_code', code)
      .single();

    if (linkError && linkError.code !== 'PGRST116') {
      logger.error('Failed to look up share link:', { code, error: linkError });
    }

    const link = rawLink as {
      id: string;
      share_kit_id: string;
      share_kit: { content_type: string; content_id: string } | null;
    } | null;

    if (!link?.share_kit) {
      return NextResponse.redirect(`${BASE_URL}/`, { status: 302 });
    }

    // Record click async (don't block the redirect)
    recordClick(link.id, request).catch((err) => {
      logger.error('Unhandled error in recordClick:', { shareLinkId: link.id, error: err });
    });

    // Resolve destination
    const destination = await resolveDestinationUrl(
      link.share_kit.content_type,
      link.share_kit.content_id,
    );

    const redirectUrl = destination ? `${BASE_URL}${destination}` : BASE_URL;
    return NextResponse.redirect(redirectUrl, { status: 302 });
  } catch (err) {
    logger.error('Unhandled error in share link redirect:', { error: err });
    return NextResponse.redirect(`${BASE_URL}/`, { status: 302 });
  }
}
