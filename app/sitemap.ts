import { MetadataRoute } from 'next';
import { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { BASE_URL } from '@/lib/constants';

interface SlugRow {
  slug: string;
  updated_at: string;
}

function toSitemapEntries(
  rows: SlugRow[],
  pathPrefix: string,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  priority: number,
): MetadataRoute.Sitemap {
  return rows.map((row) => ({
    url: `${BASE_URL}/${pathPrefix}/${row.slug}`,
    lastModified: row.updated_at ? new Date(row.updated_at) : undefined,
    changeFrequency,
    priority,
  }));
}

async function fetchSlugs(
  supabase: SupabaseClient,
  table: string,
  filters: Record<string, string>,
): Promise<SlugRow[]> {
  let query = supabase.from(table).select('slug, updated_at');
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  const { data, error } = await query;
  if (error) {
    logger.error(`Sitemap: failed to fetch from ${table}:`, error);
  }
  return (data || []) as SlugRow[];
}

const staticPages: MetadataRoute.Sitemap = [
  { url: BASE_URL, changeFrequency: 'weekly', priority: 1.0 },
  { url: `${BASE_URL}/blog`, changeFrequency: 'daily', priority: 0.9 },
  { url: `${BASE_URL}/charters`, changeFrequency: 'weekly', priority: 0.8 },
  { url: `${BASE_URL}/events`, changeFrequency: 'weekly', priority: 0.8 },
  { url: `${BASE_URL}/scorecards`, changeFrequency: 'monthly', priority: 0.8 },
  { url: `${BASE_URL}/join`, changeFrequency: 'monthly', priority: 0.8 },
  { url: `${BASE_URL}/donate`, changeFrequency: 'monthly', priority: 0.7 },
  { url: `${BASE_URL}/contact`, changeFrequency: 'monthly', priority: 0.6 },
  { url: `${BASE_URL}/action-center`, changeFrequency: 'weekly', priority: 0.7 },
  { url: `${BASE_URL}/endorsements`, changeFrequency: 'monthly', priority: 0.7 },
  { url: `${BASE_URL}/endorsements/elected-officials`, changeFrequency: 'monthly', priority: 0.6 },
  { url: `${BASE_URL}/endorsements/process`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE_URL}/candidate-surveys`, changeFrequency: 'weekly', priority: 0.7 },
  { url: `${BASE_URL}/volunteer`, changeFrequency: 'monthly', priority: 0.6 },
  { url: `${BASE_URL}/about`, changeFrequency: 'monthly', priority: 0.7 },
  { url: `${BASE_URL}/about/principles`, changeFrequency: 'yearly', priority: 0.6 },
  { url: `${BASE_URL}/about/bylaws`, changeFrequency: 'yearly', priority: 0.5 },
  { url: `${BASE_URL}/about/history`, changeFrequency: 'yearly', priority: 0.5 },
  { url: `${BASE_URL}/about/officers`, changeFrequency: 'monthly', priority: 0.6 },
  { url: `${BASE_URL}/about/committees`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE_URL}/about/speakers`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  { url: `${BASE_URL}/terms`, changeFrequency: 'yearly', priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServerClient();

  const [posts, charters, events, scorecards] = await Promise.all([
    fetchSlugs(supabase, 'rlc_posts', { status: 'published', content_type: 'post' }),
    fetchSlugs(supabase, 'rlc_charters', { status: 'active' }),
    fetchSlugs(supabase, 'rlc_events', { status: 'published' }),
    fetchSlugs(supabase, 'rlc_scorecard_sessions', { status: 'published' }),
  ]);

  return [
    ...staticPages,
    ...toSitemapEntries(posts, 'blog', 'monthly', 0.6),
    ...toSitemapEntries(charters, 'charters', 'monthly', 0.6),
    ...toSitemapEntries(events, 'events', 'weekly', 0.7),
    ...toSitemapEntries(scorecards, 'scorecards', 'monthly', 0.7),
  ];
}
