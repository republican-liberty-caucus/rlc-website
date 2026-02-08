import { Metadata } from 'next';
import Link from 'next/link';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { DonationForm } from '@/components/donate/donation-form';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Donate',
  description: 'Support the Republican Liberty Caucus and help advance liberty within the Republican Party.',
};

export default async function DonatePage() {
  const supabase = createServerClient();
  const { data: chapters } = await supabase
    .from('rlc_chapters')
    .select('id, name')
    .eq('status', 'active')
    .order('name');

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-rlc-blue to-rlc-red py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold">Support the Liberty Movement</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-white/90">
            Your donation helps us advance the principles of individual rights, limited government,
            and free markets within the Republican Party.
          </p>
        </div>
      </section>

      {/* Donation Form */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl">
            <DonationForm
              chapters={(chapters || []) as { id: string; name: string }[]}
            />
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section className="bg-muted py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-3xl font-bold text-rlc-blue">
            Your Donation Makes a Difference
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-lg bg-card p-6 text-center">
              <div className="mb-4 text-4xl font-bold text-rlc-red">$25</div>
              <p className="text-muted-foreground">
                Helps us reach 100+ potential members through targeted outreach
              </p>
            </div>
            <div className="rounded-lg bg-card p-6 text-center">
              <div className="mb-4 text-4xl font-bold text-rlc-blue">$100</div>
              <p className="text-muted-foreground">
                Supports training materials for new chapter leaders across the country
              </p>
            </div>
            <div className="rounded-lg bg-card p-6 text-center">
              <div className="mb-4 text-4xl font-bold text-rlc-blue">$500</div>
              <p className="text-muted-foreground">
                Funds candidate vetting and endorsement processes in your state
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Other Ways to Help */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-2xl font-bold">Other Ways to Support</h2>
          <p className="mb-8 text-muted-foreground">
            Can&apos;t donate right now? There are other ways to help advance liberty.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/join">Become a Member</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/chapters">Find Your Chapter</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
