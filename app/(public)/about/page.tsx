import { Metadata } from 'next';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'Learn about the Republican Liberty Caucus, our mission, history, and leadership.',
};

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      {/* Hero Section */}
      <section className="bg-rlc-blue py-16 text-white">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold">About the Republican Liberty Caucus</h1>
          <p className="mt-4 text-xl text-white/90">
            Advancing liberty within the Republican Party since 1991
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-6 text-3xl font-bold text-rlc-blue">Our Mission</h2>
            <p className="mb-4 text-lg text-muted-foreground">
              The Republican Liberty Caucus is a voluntary grassroots membership organization
              dedicated to working within the Republican Party to advance the principles of
              individual rights, limited government, and free markets.
            </p>
            <p className="mb-4 text-lg text-muted-foreground">
              We believe that the proper role of government is to protect life, liberty, and
              property. We advocate for a federal government limited to its enumerated
              constitutional powers, with most governance occurring at the state and local level
              where citizens can more effectively participate and hold officials accountable.
            </p>
          </div>
        </div>
      </section>

      {/* Core Principles */}
      <section className="bg-muted py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-3xl font-bold text-rlc-blue">Core Principles</h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg bg-card p-6">
              <h3 className="mb-3 text-xl font-semibold text-rlc-red">Individual Liberty</h3>
              <p className="text-muted-foreground">
                We believe in the inherent rights of individuals as protected by the Constitution,
                including freedom of speech, religion, assembly, and the right to keep and bear
                arms.
              </p>
            </div>
            <div className="rounded-lg bg-card p-6">
              <h3 className="mb-3 text-xl font-semibold text-rlc-red">Limited Government</h3>
              <p className="text-muted-foreground">
                We advocate for a federal government strictly limited to its constitutional powers,
                respecting the 10th Amendment and the principle of federalism.
              </p>
            </div>
            <div className="rounded-lg bg-card p-6">
              <h3 className="mb-3 text-xl font-semibold text-rlc-red">Free Markets</h3>
              <p className="text-muted-foreground">
                We support economic liberty, low taxes, reduced regulation, sound money, and
                policies that allow individuals and businesses to prosper.
              </p>
            </div>
            <div className="rounded-lg bg-card p-6">
              <h3 className="mb-3 text-xl font-semibold text-rlc-red">Property Rights</h3>
              <p className="text-muted-foreground">
                We defend the right of individuals to own, use, and dispose of their property
                without undue government interference.
              </p>
            </div>
            <div className="rounded-lg bg-card p-6">
              <h3 className="mb-3 text-xl font-semibold text-rlc-red">Fiscal Responsibility</h3>
              <p className="text-muted-foreground">
                We advocate for balanced budgets, reduced government spending, and an end to the
                unsustainable growth of the national debt.
              </p>
            </div>
            <div className="rounded-lg bg-card p-6">
              <h3 className="mb-3 text-xl font-semibold text-rlc-red">Non-Interventionism</h3>
              <p className="text-muted-foreground">
                We support a foreign policy that prioritizes American interests and avoids
                unnecessary military entanglements abroad.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* History */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-6 text-3xl font-bold text-rlc-blue">Our History</h2>
            <p className="mb-4 text-lg text-muted-foreground">
              The Republican Liberty Caucus was founded in 1991 by a group of liberty-minded
              Republicans who wanted to promote the ideals of limited government and individual
              freedom within the Republican Party.
            </p>
            <p className="mb-4 text-lg text-muted-foreground">
              Since then, we have grown into a national organization with state chapters across the
              country. We have been instrumental in promoting liberty-minded candidates and policies
              at all levels of government.
            </p>
            <p className="text-lg text-muted-foreground">
              Our members have served in positions ranging from local precinct committee positions
              to the United States Congress, always advocating for the principles of limited
              government and individual liberty.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
