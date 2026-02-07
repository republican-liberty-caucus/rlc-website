import { Metadata } from 'next';
import Link from 'next/link';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'State Chapters',
  description: 'Find your local Republican Liberty Caucus chapter and connect with liberty-minded Republicans in your state.',
};

// This would be fetched from the database in production
const placeholderChapters = [
  { slug: 'alabama', name: 'Alabama RLC', stateCode: 'AL' },
  { slug: 'arizona', name: 'Arizona RLC', stateCode: 'AZ' },
  { slug: 'california', name: 'California RLC', stateCode: 'CA' },
  { slug: 'florida', name: 'Florida RLC', stateCode: 'FL' },
  { slug: 'georgia', name: 'Georgia RLC', stateCode: 'GA' },
  { slug: 'iowa', name: 'Iowa RLC', stateCode: 'IA' },
  { slug: 'michigan', name: 'Michigan RLC', stateCode: 'MI' },
  { slug: 'new-hampshire', name: 'New Hampshire RLC', stateCode: 'NH' },
  { slug: 'ohio', name: 'Ohio RLC', stateCode: 'OH' },
  { slug: 'texas', name: 'Texas RLC', stateCode: 'TX' },
];

async function getChapters() {
  try {
    const supabase = createServerClient();
    const { data: chapters } = await supabase
      .from('rlc_chapters')
      .select('*')
      .eq('status', 'active')
      .order('name');

    return chapters || placeholderChapters;
  } catch {
    // Return placeholder data if database is not set up yet
    return placeholderChapters;
  }
}

export default async function ChaptersPage() {
  const chapters = await getChapters();

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      {/* Hero Section */}
      <section className="bg-rlc-blue py-16 text-white">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold">State Chapters</h1>
          <p className="mt-4 text-xl text-white/90">
            Connect with liberty-minded Republicans in your state
          </p>
        </div>
      </section>

      {/* Chapters Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <p className="text-lg text-muted-foreground">
              The RLC has chapters across the country working to advance liberty within the
              Republican Party. Find your state chapter below or contact us to start one in your
              area.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {chapters.map((chapter) => (
              <Link
                key={chapter.slug}
                href={`/chapters/${chapter.slug}`}
                className="group rounded-lg border bg-card p-4 transition-colors hover:border-rlc-red hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rlc-red/10 text-sm font-bold text-rlc-red">
                    {chapter.stateCode || chapter.slug.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold group-hover:text-rlc-red">
                      {chapter.name}
                    </h3>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Start a Chapter CTA */}
          <div className="mt-12 rounded-lg border bg-muted/50 p-8 text-center">
            <h2 className="mb-4 text-2xl font-bold">Don&apos;t See Your State?</h2>
            <p className="mb-6 text-muted-foreground">
              We&apos;re always looking to expand our reach. If you&apos;re interested in starting
              an RLC chapter in your state, we&apos;d love to hear from you.
            </p>
            <Button asChild className="bg-rlc-red hover:bg-rlc-red/90">
              <Link href="/contact">Contact Us to Start a Chapter</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
