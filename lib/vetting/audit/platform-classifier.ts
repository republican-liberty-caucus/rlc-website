/**
 * Platform Classifier — URL Pattern Matching for Political Candidates
 *
 * Adapted from AIdvisor Boost Authority Alignment platform-classifier.ts.
 * Adds political platforms (Ballotpedia, VoteSmart, OpenSecrets, FEC)
 * and local news/media categories.
 */

import type { PlatformClassification, PlatformCategory } from './types';

interface PlatformPattern {
  pattern: RegExp;
  type: string;
  name: string;
  category: PlatformCategory;
}

const PLATFORMS: PlatformPattern[] = [
  // ─── Political Platforms ──────────────────────────────────
  { pattern: /ballotpedia\.org/i, type: 'ballotpedia', name: 'Ballotpedia', category: 'political_platform' },
  { pattern: /votesmart\.org/i, type: 'votesmart', name: 'VoteSmart', category: 'political_platform' },
  { pattern: /opensecrets\.org/i, type: 'opensecrets', name: 'OpenSecrets', category: 'political_platform' },
  { pattern: /fec\.gov/i, type: 'fec', name: 'FEC', category: 'political_platform' },
  { pattern: /govtrack\.us/i, type: 'govtrack', name: 'GovTrack', category: 'political_platform' },
  { pattern: /congress\.gov/i, type: 'congress-gov', name: 'Congress.gov', category: 'political_platform' },
  { pattern: /followthemoney\.org/i, type: 'followthemoney', name: 'FollowTheMoney', category: 'political_platform' },
  { pattern: /vote411\.org/i, type: 'vote411', name: 'Vote411', category: 'political_platform' },
  { pattern: /isidewith\.com/i, type: 'isidewith', name: 'iSideWith', category: 'political_platform' },

  // ─── Social Media ─────────────────────────────────────────
  { pattern: /facebook\.com\/(?!marketplace|groups)/i, type: 'facebook', name: 'Facebook', category: 'social_media' },
  { pattern: /twitter\.com/i, type: 'twitter', name: 'Twitter/X', category: 'social_media' },
  { pattern: /x\.com/i, type: 'twitter', name: 'X (Twitter)', category: 'social_media' },
  { pattern: /instagram\.com/i, type: 'instagram', name: 'Instagram', category: 'social_media' },
  { pattern: /tiktok\.com/i, type: 'tiktok', name: 'TikTok', category: 'social_media' },
  { pattern: /threads\.net/i, type: 'threads', name: 'Threads', category: 'social_media' },
  { pattern: /nextdoor\.com/i, type: 'nextdoor', name: 'Nextdoor', category: 'social_media' },
  { pattern: /truthsocial\.com/i, type: 'truthsocial', name: 'Truth Social', category: 'social_media' },
  { pattern: /rumble\.com/i, type: 'rumble', name: 'Rumble', category: 'social_media' },

  // ─── Professional Networks ────────────────────────────────
  { pattern: /linkedin\.com\/in\//i, type: 'linkedin-personal', name: 'LinkedIn (Personal)', category: 'professional_network' },
  { pattern: /linkedin\.com\/company\//i, type: 'linkedin-company', name: 'LinkedIn (Company)', category: 'professional_network' },
  { pattern: /linkedin\.com/i, type: 'linkedin', name: 'LinkedIn', category: 'professional_network' },

  // ─── Content Platforms ────────────────────────────────────
  { pattern: /youtube\.com\/(?:@|c\/|channel\/|user\/)/i, type: 'youtube', name: 'YouTube', category: 'content_platform' },
  { pattern: /youtu\.be/i, type: 'youtube', name: 'YouTube', category: 'content_platform' },
  { pattern: /medium\.com/i, type: 'medium', name: 'Medium', category: 'content_platform' },
  { pattern: /substack\.com/i, type: 'substack', name: 'Substack', category: 'content_platform' },
  { pattern: /podcasts\.apple\.com/i, type: 'apple-podcasts', name: 'Apple Podcasts', category: 'content_platform' },
  { pattern: /spotify\.com\/show/i, type: 'spotify-podcast', name: 'Spotify Podcast', category: 'content_platform' },

  // ─── News / Media ─────────────────────────────────────────
  { pattern: /patch\.com/i, type: 'patch', name: 'Patch', category: 'news_media' },
  { pattern: /localnews/i, type: 'local-news', name: 'Local News', category: 'news_media' },

  // ─── Scheduling / Events ──────────────────────────────────
  { pattern: /eventbrite\.com/i, type: 'eventbrite', name: 'Eventbrite', category: 'other' },
  { pattern: /meetup\.com/i, type: 'meetup', name: 'Meetup', category: 'other' },
  { pattern: /calendly\.com/i, type: 'calendly', name: 'Calendly', category: 'other' },
  { pattern: /linktree/i, type: 'linktree', name: 'Linktree', category: 'other' },
];

const KNOWN_PLATFORM_DOMAINS = new Set([
  'linkedin.com', 'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
  'youtube.com', 'medium.com', 'substack.com', 'tiktok.com', 'threads.net',
  'ballotpedia.org', 'votesmart.org', 'opensecrets.org', 'fec.gov',
  'govtrack.us', 'congress.gov', 'patch.com', 'eventbrite.com',
  'meetup.com', 'calendly.com', 'truthsocial.com', 'rumble.com',
  'nextdoor.com',
]);

export function classifyUrl(url: string): PlatformClassification | null {
  if (!url || typeof url !== 'string') return null;
  const normalized = url.toLowerCase().trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://') && !normalized.includes('.')) {
    return null;
  }

  for (const p of PLATFORMS) {
    if (p.pattern.test(normalized)) {
      return { platformType: p.type, platformName: p.name, category: p.category };
    }
  }

  // Custom domain → campaign website or generic website
  if (isCustomDomain(normalized)) {
    return classifyCustomDomain(normalized);
  }

  return null;
}

function isCustomDomain(url: string): boolean {
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return !Array.from(KNOWN_PLATFORM_DOMAINS).some((d) => hostname.includes(d));
  } catch {
    return false;
  }
}

function classifyCustomDomain(url: string): PlatformClassification {
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    const clean = hostname.replace(/^www\./i, '');

    // Heuristic: URLs containing political keywords likely campaign sites
    const politicalKeywords = ['campaign', 'elect', 'vote', 'for', 'committee'];
    const isPolitical = politicalKeywords.some((kw) => clean.includes(kw) || url.toLowerCase().includes(kw));

    return {
      platformType: isPolitical ? 'campaign-website' : 'custom-website',
      platformName: formatDomainName(clean),
      category: isPolitical ? 'campaign_website' : 'website',
    };
  } catch {
    return { platformType: 'unknown', platformName: 'Unknown', category: 'other' };
  }
}

function formatDomainName(domain: string): string {
  const withoutTld = domain.replace(/\.(com|org|net|io|co|us|info|gov)$/i, '');
  return withoutTld
    .split(/[.-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function isPoliticalPlatform(url: string): boolean {
  const c = classifyUrl(url);
  return c?.category === 'political_platform';
}

export function isSocialMedia(url: string): boolean {
  const c = classifyUrl(url);
  return c?.category === 'social_media';
}
