import { Metadata } from 'next';
import Link from 'next/link';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Donate',
  description: 'Support the Republican Liberty Caucus and help advance liberty within the Republican Party.',
};

const donationAmounts = [25, 50, 100, 250, 500, 1000];

export default function DonatePage() {
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
            <div className="rounded-lg border bg-card p-8">
              <h2 className="mb-6 text-2xl font-bold text-center">Make a Contribution</h2>

              {/* Amount Selection */}
              <div className="mb-8">
                <label className="mb-3 block text-sm font-medium">Select Amount</label>
                <div className="grid grid-cols-3 gap-3">
                  {donationAmounts.map((amount) => (
                    <button
                      key={amount}
                      className="rounded-lg border-2 border-muted bg-background p-4 text-center font-semibold transition-colors hover:border-rlc-red focus:border-rlc-red focus:outline-none"
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-sm text-muted-foreground">
                    Or enter a custom amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <input
                      type="number"
                      placeholder="0.00"
                      className="w-full rounded-lg border bg-background pl-8 pr-4 py-3 focus:border-rlc-red focus:outline-none focus:ring-1 focus:ring-rlc-red"
                    />
                  </div>
                </div>
              </div>

              {/* Frequency */}
              <div className="mb-8">
                <label className="mb-3 block text-sm font-medium">Donation Frequency</label>
                <div className="flex gap-3">
                  <button className="flex-1 rounded-lg border-2 border-rlc-red bg-rlc-red/10 p-3 text-center font-medium text-rlc-red">
                    One-time
                  </button>
                  <button className="flex-1 rounded-lg border-2 border-muted bg-background p-3 text-center font-medium transition-colors hover:border-rlc-red">
                    Monthly
                  </button>
                </div>
              </div>

              {/* Donate Button */}
              <Button className="w-full bg-rlc-red hover:bg-rlc-red/90" size="lg">
                Donate Now
              </Button>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Contributions to the Republican Liberty Caucus are not tax-deductible. The RLC is a
                527 political organization.
              </p>
            </div>
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
              <div className="mb-4 text-4xl font-bold text-rlc-gold">$500</div>
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
              <Link href="/volunteer">Volunteer</Link>
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
