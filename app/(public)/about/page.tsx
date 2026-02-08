import { Metadata } from 'next';
import Link from 'next/link';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { BookOpen, History, ScrollText, Users, Mic } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'Learn about the Republican Liberty Caucus, our mission, history, and leadership.',
};

const subPages = [
  {
    href: '/about/principles',
    icon: BookOpen,
    title: 'Statement of Principles',
    description: 'Our core platform and policy positions',
  },
  {
    href: '/about/history',
    icon: History,
    title: 'History of the RLC',
    description: 'Our founding story and journey since 1991',
  },
  {
    href: '/about/bylaws',
    icon: ScrollText,
    title: 'Bylaws & Rules',
    description: 'Official governing documents',
  },
  {
    href: '/about/committees',
    icon: Users,
    title: 'Committees',
    description: 'Committee structure and membership',
  },
  {
    href: '/about/speakers',
    icon: Mic,
    title: 'Speakers Bureau',
    description: 'RLC speakers available for events',
  },
];

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

      {/* Learn More — sub-page navigation */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-3xl font-bold text-rlc-blue">Learn More</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {subPages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="group flex items-start gap-4 rounded-lg border bg-card p-6 transition-all hover:border-rlc-red hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rlc-red/10">
                  <page.icon className="h-5 w-5 text-rlc-red" />
                </div>
                <div>
                  <h3 className="font-semibold group-hover:text-rlc-red">{page.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{page.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
