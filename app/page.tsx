import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-rlc-blue via-rlc-blue to-rlc-red py-24 text-white">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Defending Liberty Within the GOP
            </h1>
            <p className="mb-8 text-xl text-white/90">
              The Republican Liberty Caucus is a grassroots organization working to advance the
              principles of individual rights, limited government, and free markets within the
              Republican Party.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button asChild size="lg" className="bg-rlc-gold hover:bg-rlc-gold/90 text-black">
                <Link href="/join">Join the RLC</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white/10"
              >
                <Link href="/about">Learn More</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-6 text-3xl font-bold text-rlc-blue">Our Mission</h2>
            <p className="mb-8 text-lg text-muted-foreground">
              We believe that the proper role of government is to protect life, liberty, and
              property. We work within the Republican Party to elect liberty-minded candidates and
              advance policies that respect individual rights and limit government power.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="rounded-lg border bg-card p-6 text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rlc-red/10">
                  <svg
                    className="h-6 w-6 text-rlc-red"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="mb-2 text-xl font-semibold">Individual Rights</h3>
              <p className="text-muted-foreground">
                We defend the rights of individuals as protected by the Constitution, including free
                speech, due process, and property rights.
              </p>
            </div>

            <div className="rounded-lg border bg-card p-6 text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rlc-blue/10">
                  <svg
                    className="h-6 w-6 text-rlc-blue"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="mb-2 text-xl font-semibold">Limited Government</h3>
              <p className="text-muted-foreground">
                We advocate for a federal government limited to its constitutional powers, with most
                governance occurring at the state and local level.
              </p>
            </div>

            <div className="rounded-lg border bg-card p-6 text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rlc-gold/10">
                  <svg
                    className="h-6 w-6 text-rlc-gold"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="mb-2 text-xl font-semibold">Free Markets</h3>
              <p className="text-muted-foreground">
                We support economic freedom, low taxes, reduced regulation, and policies that allow
                individuals and businesses to thrive.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* State Chapters CTA */}
      <section className="bg-muted py-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div>
              <h2 className="mb-2 text-3xl font-bold text-rlc-blue">Find Your State Chapter</h2>
              <p className="text-lg text-muted-foreground">
                Connect with liberty-minded Republicans in your state.
              </p>
            </div>
            <Button asChild size="lg" className="bg-rlc-red hover:bg-rlc-red/90">
              <Link href="/chapters">Browse Chapters</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Events Preview */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-3xl font-bold text-rlc-blue">Upcoming Events</h2>
            <Button asChild variant="outline">
              <Link href="/events">View All Events</Link>
            </Button>
          </div>
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">
              Check back soon for upcoming RLC events and meetings.
            </p>
          </div>
        </div>
      </section>

      {/* Join CTA */}
      <section className="bg-rlc-blue py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold">Ready to Make a Difference?</h2>
          <p className="mb-8 text-lg text-white/90">
            Join thousands of liberty-minded Republicans working to advance freedom within the GOP.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="bg-rlc-gold hover:bg-rlc-gold/90 text-black">
              <Link href="/join">Become a Member</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10"
            >
              <Link href="/donate">Donate</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
