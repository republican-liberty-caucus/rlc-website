import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import { rewriteWPImageUrl } from '@/lib/wordpress/content';
import { EmptyState } from '@/components/ui/empty-state';
import { FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'News & Blog',
  description: 'Latest news, updates, and commentary from the Republican Liberty Caucus.',
};

interface PostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  published_at: string | null;
  categories: string[];
  tags: string[];
  author: { first_name: string; last_name: string } | null;
  charter: { name: string; slug: string } | null;
}

const PAGE_SIZE = 12;

async function getPosts(page: number): Promise<{ posts: PostRow[]; total: number }> {
  const supabase = createServerClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await supabase
    .from('rlc_posts')
    .select(
      `
      id, title, slug, excerpt, featured_image_url, published_at, categories, tags,
      author:rlc_contacts(first_name, last_name),
      charter:rlc_charters(name, slug)
    `,
      { count: 'exact' }
    )
    .eq('status', 'published')
    .eq('content_type', 'post')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .range(from, to);

  return { posts: (data || []) as PostRow[], total: count || 0 };
}

interface BlogPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const { posts, total } = await getPosts(currentPage);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      {/* Hero */}
      <section className="bg-rlc-blue py-16 text-white">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold sm:text-3xl md:text-4xl">News &amp; Blog</h1>
          <p className="mt-4 text-xl text-white/90">
            Latest updates from the Republican Liberty Caucus
          </p>
        </div>
      </section>

      {/* Posts */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {posts.length > 0 ? (
            <>
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    className="group overflow-hidden rounded-lg border bg-card transition-colors hover:border-rlc-red"
                  >
                    {post.featured_image_url && (
                      <div className="relative aspect-video overflow-hidden bg-muted">
                        <Image
                          src={rewriteWPImageUrl(post.featured_image_url)}
                          alt={post.title}
                          fill
                          unoptimized
                          className="object-cover transition-transform group-hover:scale-105"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      {post.categories.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {post.categories.slice(0, 3).map((cat) => (
                            <span
                              key={cat}
                              className="rounded-full bg-rlc-red/10 px-2 py-0.5 text-xs font-medium text-rlc-red capitalize"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}
                      <h2 className="mb-2 text-lg font-semibold group-hover:text-rlc-red">
                        {post.title}
                      </h2>
                      {post.excerpt && (
                        <p className="mb-4 line-clamp-3 text-sm text-muted-foreground">
                          {post.excerpt}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {post.author && (
                          <span>
                            {post.author.first_name} {post.author.last_name}
                          </span>
                        )}
                        {post.author && post.published_at && <span>&middot;</span>}
                        {post.published_at && <span>{formatDate(post.published_at)}</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <nav className="mt-12 flex items-center justify-center gap-4" aria-label="Blog pagination">
                  {currentPage > 1 ? (
                    <Link
                      href={`/blog?page=${currentPage - 1}`}
                      className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                    >
                      &larr; Previous
                    </Link>
                  ) : (
                    <span className="rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground opacity-50">
                      &larr; Previous
                    </span>
                  )}

                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>

                  {currentPage < totalPages ? (
                    <Link
                      href={`/blog?page=${currentPage + 1}`}
                      className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                    >
                      Next &rarr;
                    </Link>
                  ) : (
                    <span className="rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground opacity-50">
                      Next &rarr;
                    </span>
                  )}
                </nav>
              )}
            </>
          ) : (
            <EmptyState
              icon={<FileText className="h-12 w-12" />}
              title="No Posts Yet"
              description="Follow us on social media for the latest news and updates from the RLC."
              action={{ label: 'Visit Action Center', href: '/action-center' }}
            />
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
