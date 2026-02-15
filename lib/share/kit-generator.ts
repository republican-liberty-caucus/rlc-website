import { createServerClient } from '@/lib/supabase/server';
import { generateSocialCopy } from '@/lib/share/copy-generator';
import { logger } from '@/lib/logger';
import { BASE_URL } from '@/lib/constants';
import type { VettingRecommendation } from '@/types';

/**
 * Auto-generate a share kit for an endorsement after board vote finalization.
 * Non-fatal: logs warnings on failure, never throws.
 */
export async function generateEndorsementShareKit(params: {
  vettingId: string;
  candidateName: string;
  candidateOffice: string | null;
  candidateState: string | null;
  endorsementResult: VettingRecommendation;
}): Promise<string | null> {
  try {
    const supabase = createServerClient();

    // Build title matching the press release pattern
    let title: string;
    const office = params.candidateOffice || 'Office';
    switch (params.endorsementResult) {
      case 'endorse':
        title = `RLC Endorses ${params.candidateName} for ${office}`;
        break;
      case 'do_not_endorse':
        title = `RLC Does Not Endorse ${params.candidateName} for ${office}`;
        break;
      case 'no_position':
        title = `RLC Takes No Position on ${params.candidateName} for ${office}`;
        break;
      default:
        title = `RLC Endorsement Decision: ${params.candidateName} for ${office}`;
    }

    const description = params.candidateState
      ? `${params.candidateName} — ${office}, ${params.candidateState}`
      : `${params.candidateName} — ${office}`;

    // Generate AI social copy
    const socialCopy = await generateSocialCopy({
      contentType: 'endorsement',
      title,
      candidateName: params.candidateName,
      candidateOffice: params.candidateOffice,
      candidateState: params.candidateState,
      endorsementResult: params.endorsementResult,
    });

    // Create share kit record
    const { data, error } = await supabase
      .from('rlc_share_kits')
      .insert({
        content_type: 'endorsement',
        content_id: params.vettingId,
        title,
        description,
        social_copy: socialCopy,
        og_image_url: `${BASE_URL}/api/og/share-kit/PLACEHOLDER`,
        status: 'active',
        scope: 'national',
      } as never)
      .select('id')
      .single();

    if (error) {
      // Duplicate key means kit already exists — that's fine
      if (error.code === '23505') {
        logger.info('Share kit already exists for endorsement:', { vettingId: params.vettingId });
        const { data: existing } = await supabase
          .from('rlc_share_kits')
          .select('id')
          .eq('content_type', 'endorsement')
          .eq('content_id', params.vettingId)
          .single();
        return (existing as { id: string } | null)?.id || null;
      }
      logger.error('Failed to create endorsement share kit:', { vettingId: params.vettingId, error });
      return null;
    }

    const shareKitId = (data as { id: string }).id;

    // Update og_image_url with actual ID
    const { error: updateError } = await supabase
      .from('rlc_share_kits')
      .update({ og_image_url: `${BASE_URL}/api/og/share-kit/${shareKitId}` } as never)
      .eq('id', shareKitId);

    if (updateError) {
      logger.error('Failed to update og_image_url on share kit:', { shareKitId, error: updateError });
    }

    logger.info('Created endorsement share kit:', { shareKitId, vettingId: params.vettingId });
    return shareKitId;
  } catch (err) {
    logger.error('Unexpected error generating endorsement share kit:', {
      vettingId: params.vettingId,
      error: err,
    });
    return null;
  }
}
