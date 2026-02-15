import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { BASE_URL } from '@/lib/constants';
import crypto from 'crypto';

/**
 * Generate a URL-safe short code for tracked links.
 * Uses 6 bytes of randomness -> 8 base64url chars -> ~281 trillion possibilities.
 */
export function generateShortCode(): string {
  return crypto.randomBytes(6).toString('base64url');
}

/**
 * Build the full tracked URL for a share link.
 */
export function buildTrackedUrl(shortCode: string): string {
  return `${BASE_URL}/s/${shortCode}`;
}

/**
 * Resolve a share link's destination URL from its share kit content.
 */
export async function resolveDestinationUrl(
  contentType: string,
  contentId: string,
): Promise<string | null> {
  const supabase = createServerClient();

  switch (contentType) {
    case 'endorsement': {
      // Try vetting record first (content_id = vetting ID)
      const { data, error } = await supabase
        .from('rlc_candidate_vettings')
        .select('press_release_post_id, press_release_post:rlc_posts!press_release_post_id(slug)')
        .eq('id', contentId)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Failed to resolve endorsement destination:', { contentId, error });
      }

      const vetting = data as { press_release_post_id: string | null; press_release_post: { slug: string } | null } | null;
      if (vetting?.press_release_post?.slug) {
        return `/press-releases/${vetting.press_release_post.slug}`;
      }

      // Fallback: content_id may be a post ID directly (endorsements created outside vetting pipeline)
      const { data: post, error: postError } = await supabase
        .from('rlc_posts')
        .select('slug')
        .eq('id', contentId)
        .single();

      if (postError && postError.code !== 'PGRST116') {
        logger.error('Failed to resolve endorsement post destination:', { contentId, error: postError });
      }

      const resolvedPost = post as { slug: string } | null;
      if (resolvedPost?.slug) {
        return `/press-releases/${resolvedPost.slug}`;
      }

      return '/endorsements';
    }

    case 'campaign': {
      const { data, error } = await supabase
        .from('rlc_action_campaigns')
        .select('slug')
        .eq('id', contentId)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Failed to resolve campaign destination:', { contentId, error });
      }

      const campaign = data as { slug: string } | null;
      if (campaign?.slug) {
        return `/action-center/contact?campaign=${campaign.slug}`;
      }
      return '/action-center';
    }

    case 'event': {
      const { data, error } = await supabase
        .from('rlc_events')
        .select('slug')
        .eq('id', contentId)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Failed to resolve event destination:', { contentId, error });
      }

      const event = data as { slug: string } | null;
      if (event?.slug) {
        return `/events/${event.slug}`;
      }
      return '/events';
    }

    default:
      return null;
  }
}

/**
 * Record a link click asynchronously (fire-and-forget).
 */
export async function recordClick(
  shareLinkId: string,
  request: Request,
): Promise<void> {
  try {
    const supabase = createServerClient();
    const headers = request.headers;

    const { error } = await supabase
      .from('rlc_link_clicks')
      .insert({
        share_link_id: shareLinkId,
        referrer: headers.get('referer') || null,
        user_agent: headers.get('user-agent') || null,
      } as never);

    if (error) {
      logger.error('Failed to record link click:', { shareLinkId, error });
    }
  } catch (err) {
    logger.error('Failed to record link click:', { shareLinkId, error: err });
  }
}

/**
 * Get or create a tracked share link for a member + share kit pair.
 */
export async function getOrCreateShareLink(
  shareKitId: string,
  memberId: string,
): Promise<{ id: string; short_code: string } | null> {
  const supabase = createServerClient();

  // Check for existing
  const { data: existing, error: existingError } = await supabase
    .from('rlc_share_links')
    .select('id, short_code')
    .eq('share_kit_id', shareKitId)
    .eq('member_id', memberId)
    .single();

  if (existingError && existingError.code !== 'PGRST116') {
    logger.error('Failed to check for existing share link:', { shareKitId, memberId, error: existingError });
    return null;
  }

  if (existing) {
    return existing as { id: string; short_code: string };
  }

  // Create new
  const shortCode = generateShortCode();
  const { data: created, error } = await supabase
    .from('rlc_share_links')
    .insert({
      share_kit_id: shareKitId,
      member_id: memberId,
      short_code: shortCode,
    } as never)
    .select('id, short_code')
    .single();

  if (error) {
    // Handle race condition: another request created it first
    if (error.code === '23505') {
      const { data: raceWinner, error: raceError } = await supabase
        .from('rlc_share_links')
        .select('id, short_code')
        .eq('share_kit_id', shareKitId)
        .eq('member_id', memberId)
        .single();

      if (raceError) {
        logger.error('Failed to fetch share link after race condition:', { shareKitId, memberId, error: raceError });
        return null;
      }
      return raceWinner as { id: string; short_code: string } | null;
    }
    logger.error('Failed to create share link:', { shareKitId, memberId, error });
    return null;
  }

  return created as { id: string; short_code: string };
}
