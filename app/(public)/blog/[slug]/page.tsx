import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

interface BlogPostProps {
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
  chapter: { name: string; slug: string } | null;
}

async function getPost(slug: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('rlc_posts')
    .select(`
      *,
      author:rlc_members(first_name, last_name),
      chapter:rlc_chapters(name, slug)
    `)
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error || !data) return null;
  return data as PostRow;
}

export async function generateMetadata({ params }: BlogPostProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: 'Post Not Found' };

  return {
    title: post.seo_title || `${post.title} - RLC Blog`,
    description: post.seo_description || post.excerpt || undefined,
  };
}

export default async function BlogPostPage({ params }: BlogPostProps) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <article className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            {/* Breadcrumb */}
            <Link href="/blog" className="text-sm text-rlc-red hover:underline">
              &larr; Back to Blog
            </Link>

            {/* Categories */}
            {post.categories.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {post.categories.map((cat) => (
                  <span key={cat} className="rounded-full bg-rlc-red/10 px-3 py-1 text-xs font-medium text-rlc-red capitalize">
                    {cat}
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
              {post.chapter && (
                <Link
                  href={`/chapters/${post.chapter.slug}`}
                  className="text-rlc-red hover:underline"
                >
                  &middot; {post.chapter.name}
                </Link>
              )}
            </div>

            {/* Featured Image */}
            {post.featured_image_url && (
              <div className="mt-8 overflow-hidden rounded-lg">
                <img
                  src={post.featured_image_url}
                  alt={post.title}
                  className="w-full object-cover"
                />
              </div>
            )}

            {/* Content */}
            {post.content && (
              <div
                className="prose prose-lg mt-8 max-w-none"
                dangerouslySetInnerHTML={{ __html: post.content }}
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
