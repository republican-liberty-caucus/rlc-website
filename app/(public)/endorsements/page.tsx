import { Metadata } from 'next';
import Link from 'next/link';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { createServerClient } from '@/lib/supabase/server';
import { getWPPageContent, sanitizeWPContent } from '@/lib/wordpress/content';
import { formatDate, formatCandidateName } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Endorsements',
  description: 'Republican Liberty Caucus national endorsements for liberty-minded candidates.',
};

interface EndorsedCandidate {
  id: string;
  candidate_first_name: string;
  candidate_last_name: string;
  candidate_office: string | null;
  candidate_state: string | null;
  candidate_district: string | null;
  endorsed_at: string | null;
  press_release_post_id: string | null;
  press_release_post: { slug: string; status: string } | null;
}

async function getEndorsedCandidates(): Promise<EndorsedCandidate[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('rlc_candidate_vettings')
    .select(`
      id, candidate_first_name, candidate_last_name, candidate_office, candidate_state, candidate_district,
      endorsed_at, press_release_post_id,
      press_release_post:rlc_posts!press_release_post_id(slug, status)
    `)
    .eq('endorsement_result', 'endorse')
    .order('endorsed_at', { ascending: false });

  if (error) {
    // Non-fatal: return empty if query fails (WP content still renders)
    return [];
  }

  return (data || []) as EndorsedCandidate[];
}

export default async function EndorsementsPage() {
  const [wpPage, endorsedCandidates] = await Promise.all([
    getWPPageContent('endorsements'),
    getEndorsedCandidates(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <section className="bg-rlc-blue py-16 text-white">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold sm:text-3xl md:text-4xl">Endorsements</h1>
          <p className="mt-4 text-xl text-white/90">
            RLC-endorsed candidates for office
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            {/* WP intro content (if available) */}
            {wpPage?.content && (
              <div
                className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-a:text-rlc-red prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-img:w-full prose-img:h-auto mb-12"
                dangerouslySetInnerHTML={{ __html: sanitizeWPContent(wpPage.content) }}
              />
            )}

            {/* Dynamic endorsed candidates */}
            {endorsedCandidates.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Endorsed Candidates</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {endorsedCandidates.map((candidate) => {
                    const hasPublishedPR =
                      candidate.press_release_post_id &&
                      candidate.press_release_post?.status === 'published';

                    return (
                      <div
                        key={candidate.id}
                        className="rounded-lg border bg-card p-5 hover:border-rlc-red transition-colors"
                      >
                        <h3 className="font-semibold text-lg">{formatCandidateName(candidate.candidate_first_name, candidate.candidate_last_name)}</h3>
                        {candidate.candidate_office && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {candidate.candidate_office}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          {candidate.candidate_state && (
                            <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                              {candidate.candidate_state}
                            </span>
                          )}
                          {candidate.candidate_district && (
                            <span>{candidate.candidate_district}</span>
                          )}
                        </div>
                        {candidate.endorsed_at && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Endorsed {formatDate(candidate.endorsed_at)}
                          </p>
                        )}
                        {hasPublishedPR && candidate.press_release_post?.slug && (
                          <Link
                            href={`/press-releases/${candidate.press_release_post.slug}`}
                            className="inline-block mt-3 text-sm text-rlc-red hover:underline font-medium"
                          >
                            Read Press Release &rarr;
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
