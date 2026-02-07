import { Metadata } from 'next';
import Link from 'next/link';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Join the RLC',
  description: 'Become a member of the Republican Liberty Caucus and help advance liberty within the Republican Party.',
};

const membershipTiers = [
  {
    name: 'Supporter',
    price: 'Free',
    description: 'Stay informed about RLC activities',
    features: [
      'Email newsletter',
      'Event announcements',
      'Access to public resources',
    ],
    cta: 'Sign Up Free',
    href: '/sign-up',
    featured: false,
  },
  {
    name: 'Member',
    price: '$35',
    period: '/year',
    description: 'Full voting membership in the RLC',
    features: [
      'Everything in Supporter',
      'Voting rights at conventions',
      'Member-only communications',
      'State chapter membership',
      'RLC membership card',
    ],
    cta: 'Join Now',
    href: '/sign-up?tier=member',
    featured: true,
  },
  {
    name: 'Sustaining',
    price: '$10',
    period: '/month',
    description: 'Monthly support for the liberty movement',
    features: [
      'Everything in Member',
      'Recognition as Sustaining Member',
      'Priority access to events',
      'Quarterly leadership calls',
    ],
    cta: 'Become Sustaining',
    href: '/sign-up?tier=sustaining',
    featured: false,
  },
  {
    name: 'Lifetime',
    price: '$500',
    period: 'one-time',
    description: 'Permanent membership in the RLC',
    features: [
      'Everything in Sustaining',
      'Lifetime membership status',
      'Special recognition at events',
      'Lifetime member pin',
    ],
    cta: 'Join for Life',
    href: '/sign-up?tier=lifetime',
    featured: false,
  },
];

export default function JoinPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-rlc-blue to-rlc-red py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold">Join the Republican Liberty Caucus</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-white/90">
            Stand with thousands of liberty-minded Republicans working to advance individual rights,
            limited government, and free markets within the GOP.
          </p>
        </div>
      </section>

      {/* Membership Tiers */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {membershipTiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-lg border ${
                  tier.featured ? 'border-rlc-red shadow-lg' : ''
                } bg-card p-6`}
              >
                {tier.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-rlc-red px-3 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="text-xl font-semibold">{tier.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">{tier.price}</span>
                    {tier.period && (
                      <span className="text-muted-foreground">{tier.period}</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
                </div>
                <ul className="mb-6 space-y-2">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-rlc-red" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={`w-full ${
                    tier.featured
                      ? 'bg-rlc-red hover:bg-rlc-red/90'
                      : 'bg-rlc-blue hover:bg-rlc-blue/90'
                  }`}
                >
                  <Link href={tier.href}>{tier.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-muted py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-3xl font-bold text-rlc-blue">
            Why Join the RLC?
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rlc-red/10">
                  <svg
                    className="h-8 w-8 text-rlc-red"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="mb-2 text-xl font-semibold">Join a Community</h3>
              <p className="text-muted-foreground">
                Connect with like-minded Republicans who share your commitment to liberty and
                limited government.
              </p>
            </div>
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rlc-blue/10">
                  <svg
                    className="h-8 w-8 text-rlc-blue"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="mb-2 text-xl font-semibold">Make Your Voice Heard</h3>
              <p className="text-muted-foreground">
                Participate in shaping the platform and direction of the Republican Party from
                within.
              </p>
            </div>
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rlc-gold/10">
                  <svg
                    className="h-8 w-8 text-rlc-gold"
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
              <h3 className="mb-2 text-xl font-semibold">Defend Liberty</h3>
              <p className="text-muted-foreground">
                Support candidates and policies that protect individual rights and limit government
                power.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
