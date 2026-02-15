import { logger } from '@/lib/logger';
import type { SocialCopyVariants } from '@/types';

/**
 * Generate social copy variants for a share kit using Claude API.
 * Returns 3 tone variants (formal, casual, punchy) for 3 platforms (X, Facebook, LinkedIn).
 */
export async function generateSocialCopy(params: {
  contentType: string;
  title: string;
  candidateName?: string;
  candidateOffice?: string | null;
  candidateState?: string | null;
  endorsementResult?: string | null;
  description?: string | null;
}): Promise<SocialCopyVariants> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.error('ANTHROPIC_API_KEY not set — social copy generation disabled');
    return buildFallbackCopy(params);
  }

  const contextParts: string[] = [];
  if (params.contentType === 'endorsement') {
    contextParts.push(`The Republican Liberty Caucus has made an endorsement decision.`);
    if (params.candidateName) contextParts.push(`Candidate: ${params.candidateName}`);
    if (params.candidateOffice) contextParts.push(`Office: ${params.candidateOffice}`);
    if (params.candidateState) contextParts.push(`State: ${params.candidateState}`);
    if (params.endorsementResult) contextParts.push(`Decision: ${params.endorsementResult.replace(/_/g, ' ')}`);
  } else {
    contextParts.push(`Title: ${params.title}`);
    if (params.description) contextParts.push(`Description: ${params.description}`);
  }

  const prompt = `Generate social media copy for the Republican Liberty Caucus (RLC) to share the following:

${contextParts.join('\n')}

Generate 3 tone variants for each of 3 platforms. Each variant should be standalone and complete.

Platform constraints:
- X/Twitter: max 250 characters (leave room for a link)
- Facebook: 1-3 sentences
- LinkedIn: 2-3 sentences, professional tone

Tone variants:
- formal: Professional, press-release style
- casual: Friendly, conversational
- punchy: Bold, attention-grabbing, may use caps for emphasis

Do NOT include hashtags. Do NOT include URLs (the system adds those).
Do NOT include emojis.

Return ONLY valid JSON in exactly this format, no other text:
{
  "x": { "formal": "...", "casual": "...", "punchy": "..." },
  "facebook": { "formal": "...", "casual": "...", "punchy": "..." },
  "linkedin": { "formal": "...", "casual": "...", "punchy": "..." }
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.warn('Claude API error generating social copy:', { status: response.status, body: errText });
      return buildFallbackCopy(params);
    }

    const result = await response.json();
    const text = result.content?.[0]?.text;
    if (!text) {
      logger.warn('Claude API returned empty content for social copy');
      return buildFallbackCopy(params);
    }

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('Could not extract JSON from Claude response:', { text: text.slice(0, 200) });
      return buildFallbackCopy(params);
    }

    const parsed = JSON.parse(jsonMatch[0]) as SocialCopyVariants;

    // Validate structure
    for (const platform of ['x', 'facebook', 'linkedin'] as const) {
      if (!parsed[platform]?.formal || !parsed[platform]?.casual || !parsed[platform]?.punchy) {
        logger.warn('Incomplete social copy structure from Claude:', { platform });
        return buildFallbackCopy(params);
      }
    }

    return parsed;
  } catch (err) {
    logger.warn('Failed to generate social copy via Claude:', { error: err });
    return buildFallbackCopy(params);
  }
}

/**
 * Build deterministic fallback copy when AI generation fails.
 */
function buildFallbackCopy(params: {
  contentType: string;
  title: string;
}): SocialCopyVariants {
  const title = params.title;

  const formal = `The Republican Liberty Caucus announces: ${title}`;
  const casual = `Big news from the RLC — ${title}`;
  const punchy = `${title}`;

  return {
    x: { formal, casual, punchy },
    facebook: { formal, casual, punchy },
    linkedin: { formal, casual, punchy },
  };
}
