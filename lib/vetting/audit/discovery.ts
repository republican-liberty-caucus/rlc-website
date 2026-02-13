/**
 * Discovery Engine — Multi-Hop Search for Political Candidate Platforms
 *
 * Adapted from AIdvisor Boost discovery-engine.ts + multi-hop-search.ts.
 * Uses Tavily API (direct fetch, not MCP) for server-side search.
 * Max 3 hops: general → platform-specific → political databases.
 */

import { logger } from '@/lib/logger';
import type { DiscoveredUrl, DiscoveryResult, HopLog, AuditInput } from './types';

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

interface TavilyResponse {
  results: TavilyResult[];
}

const MAX_HOPS = 3;
const RESULTS_PER_HOP = 10;

/**
 * Run multi-hop discovery to find candidate platforms.
 */
export async function discoverPlatforms(input: AuditInput): Promise<DiscoveryResult> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) {
    logger.warn('TAVILY_API_KEY not set — discovery will return only known URLs');
    return { urls: knownUrlsOnly(input), hops: [], totalSearches: 0 };
  }

  const allUrls: DiscoveredUrl[] = [];
  const hops: HopLog[] = [];
  const seenUrls = new Set<string>();

  // Seed with known URLs
  for (const url of input.knownUrls) {
    seenUrls.add(normalizeUrl(url));
    allUrls.push({
      url,
      title: '',
      snippet: '',
      discoveryMethod: 'known',
      hop: 0,
    });
  }

  // ─── Hop 1: General search ────────────────────────────────
  const hop1Queries = [
    `"${input.candidateName}" ${input.state ?? ''} ${input.office ?? ''}`,
    `"${input.candidateName}" campaign website`,
  ];

  for (const query of hop1Queries) {
    const result = await searchTavily(tavilyKey, query, 1, hops);
    addNewUrls(result, allUrls, seenUrls, 'tavily_general', 1);
  }

  // ─── Hop 2: Platform-specific searches ────────────────────
  const hop2Queries = [
    `"${input.candidateName}" site:facebook.com OR site:x.com OR site:instagram.com`,
    `"${input.candidateName}" site:linkedin.com OR site:youtube.com`,
    `"${input.candidateName}" ${input.state ?? ''} site:ballotpedia.org OR site:votesmart.org`,
  ];

  for (const query of hop2Queries) {
    const result = await searchTavily(tavilyKey, query, 2, hops);
    addNewUrls(result, allUrls, seenUrls, 'tavily_platform', 2);
  }

  // ─── Hop 3: Political databases & FEC ─────────────────────
  const hop3Queries = [
    `"${input.candidateName}" FEC campaign finance filing`,
    `"${input.candidateName}" ${input.office ?? ''} endorsement news`,
  ];

  for (const query of hop3Queries) {
    const result = await searchTavily(tavilyKey, query, 3, hops);
    addNewUrls(result, allUrls, seenUrls, 'tavily_political', 3);
  }

  return { urls: allUrls, hops, totalSearches: hops.length };
}

/**
 * Discover opponent platforms (lightweight — single hop).
 */
export async function discoverOpponentPlatforms(
  opponentName: string,
  state: string | null,
  office: string | null,
): Promise<DiscoveredUrl[]> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) return [];

  const hops: HopLog[] = [];
  const allUrls: DiscoveredUrl[] = [];
  const seenUrls = new Set<string>();

  const query = `"${opponentName}" ${state ?? ''} ${office ?? ''} campaign`;
  const result = await searchTavily(tavilyKey, query, 1, hops);
  addNewUrls(result, allUrls, seenUrls, 'tavily_opponent', 1);

  return allUrls;
}

// ─── Tavily API Call ──────────────────────────────────────────────

async function searchTavily(
  apiKey: string,
  query: string,
  hop: number,
  hops: HopLog[],
): Promise<TavilyResult[]> {
  const start = Date.now();
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: RESULTS_PER_HOP,
        search_depth: hop <= 1 ? 'advanced' : 'basic',
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      logger.error(`Tavily search failed (${res.status}):`, errBody.slice(0, 200));
      hops.push({ hop, query, resultsFound: 0, durationMs: Date.now() - start });
      return [];
    }

    const data: TavilyResponse = await res.json();
    const results = data.results ?? [];
    hops.push({ hop, query, resultsFound: results.length, durationMs: Date.now() - start });
    return results;
  } catch (err) {
    logger.error(`Tavily search error (hop ${hop}):`, err);
    hops.push({ hop, query, resultsFound: 0, durationMs: Date.now() - start });
    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function addNewUrls(
  results: TavilyResult[],
  allUrls: DiscoveredUrl[],
  seenUrls: Set<string>,
  method: string,
  hop: number,
) {
  for (const r of results) {
    const normalized = normalizeUrl(r.url);
    if (seenUrls.has(normalized)) continue;
    seenUrls.add(normalized);
    allUrls.push({
      url: r.url,
      title: r.title ?? '',
      snippet: (r.content ?? '').slice(0, 300),
      discoveryMethod: method,
      hop,
    });
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/+$/, '');
  }
}

function knownUrlsOnly(input: AuditInput): DiscoveredUrl[] {
  return input.knownUrls.map((url) => ({
    url,
    title: '',
    snippet: '',
    discoveryMethod: 'known',
    hop: 0,
  }));
}
