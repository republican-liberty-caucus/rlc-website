import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { BASE_URL } from '@/lib/constants';
import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { formatDate } from '@/lib/utils';
import { sanitizeWPContent, rewriteWPImageUrl } from '@/lib/wordpress/content';

interface PressReleasePageProps {
  params: Promise<{ slug: string }>;
}

interface PostRow {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  featured_image_url: string | null;
  published_at: string | null;
  categories: string[];
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  author: { first_name: string; last_name: string } | null;
}

async function getPressRelease(slug: string): Promise<PostRow | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('rlc_posts')
    .select(`
      *,
      author:rlc_members(first_name, last_name)
    `)
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('content_type', 'press_release')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logger.error(`Error fetching press release slug="${slug}":`, error);
    throw new Error(`Failed to fetch press release: ${error.message}`);
  }

  return data as PostRow;
}

export async function generateMetadata({ params }: PressReleasePageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPressRelease(slug);
  if (!post) return { title: 'Press Release Not Found' };

  return {
    title: post.seo_title || `${post.title} - RLC Press Release`,
    description: post.seo_description || post.excerpt || undefined,
  };
}

export default async function PressReleaseDetailPage({ params }: PressReleasePageProps) {
  const { slug } = await params;
  const post = await getPressRelease(slug);
  if (!post) notFound();

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: post.title,
    datePublished: post.published_at || undefined,
    ...(post.featured_image_url && { image: rewriteWPImageUrl(post.featured_image_url) }),
    ...(post.author && {
      author: {
        '@type': 'Person',
        name: `${post.author.first_name} ${post.author.last_name}`,
      },
    }),
    publisher: {
      '@type': 'Organization',
      name: 'Republican Liberty Caucus',
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/images/rlc-logo-200.png` },
    },
    url: `${BASE_URL}/press-releases/${post.slug}`,
    description: post.seo_description || post.excerpt || undefined,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <article className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            {/* Breadcrumb */}
            <Link href="/press-releases" className="text-sm text-rlc-red hover:underline">
              &larr; Back to Press Releases
            </Link>

            {/* Categories */}
            {post.categories.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {post.categories.map((cat) => (
                  <span key={cat} className="rounded-full bg-rlc-red/10 px-3 py-1 text-xs font-medium text-rlc-red capitalize">
                    {cat.replace(/-/g, ' ')}
                  </span>
                ))}
              </div>
            )}

            {/* Title */}
            <h1 className="mt-4 text-4xl font-bold">{post.title}</h1>

            {/* Byline */}
            <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
              {post.author && (
                <span>By {post.author.first_name} {post.author.last_name}</span>
              )}
              {post.published_at && (
                <span>&middot; {formatDate(post.published_at)}</span>
              )}
            </div>

            {/* Featured Image */}
            {post.featured_image_url && (
              <div className="relative mt-8 aspect-video overflow-hidden rounded-lg">
                <Image
                  src={rewriteWPImageUrl(post.featured_image_url)}
                  alt={post.title}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            )}

            {/* Content */}
            {post.content && (
              <div
                className="prose prose-lg mt-8 max-w-none dark:prose-invert prose-headings:text-foreground prose-a:text-rlc-red prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-img:w-full prose-img:h-auto"
                dangerouslySetInnerHTML={{ __html: sanitizeWPContent(post.content) }}
              />
            )}

            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="mt-12 border-t pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Tags:</span>
                  {post.tags.map((tag) => (
                    <span key={tag} className="rounded-full border px-3 py-1 text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </article>

      <Footer />
    </div>
  );
}
