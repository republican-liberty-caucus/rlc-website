import { Metadata } from 'next';
import Link from 'next/link';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

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
  chapter: { name: string; slug: string } | null;
}

async function getPosts(): Promise<PostRow[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('rlc_posts')
    .select(`
      id, title, slug, excerpt, featured_image_url, published_at, categories, tags,
      author:rlc_members(first_name, last_name),
      chapter:rlc_chapters(name, slug)
    `)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(20);

  return (data || []) as PostRow[];
}

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      {/* Hero */}
      <section className="bg-rlc-blue py-16 text-white">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold">News &amp; Blog</h1>
          <p className="mt-4 text-xl text-white/90">
            Latest updates from the Republican Liberty Caucus
          </p>
        </div>
      </section>

      {/* Posts */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {posts.length > 0 ? (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group overflow-hidden rounded-lg border bg-card transition-colors hover:border-rlc-red"
                >
                  {post.featured_image_url && (
                    <div className="aspect-video overflow-hidden bg-muted">
                      <img
                        src={post.featured_image_url}
                        alt={post.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    {post.categories.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {post.categories.slice(0, 3).map((cat) => (
                          <span key={cat} className="rounded-full bg-rlc-red/10 px-2 py-0.5 text-xs font-medium text-rlc-red capitalize">
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
                        <span>{post.author.first_name} {post.author.last_name}</span>
                      )}
                      {post.author && post.published_at && <span>&middot;</span>}
                      {post.published_at && <span>{formatDate(post.published_at)}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/50 p-12 text-center">
              <h2 className="mb-4 text-2xl font-semibold">No Posts Yet</h2>
              <p className="text-muted-foreground">
                Check back soon for news and updates from the RLC.
              </p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
