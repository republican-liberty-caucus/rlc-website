import { Metadata } from 'next';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { Users, Star, Megaphone } from 'lucide-react';
import { MEMBERSHIP_TIERS } from '@/lib/stripe/client';
import { JoinTierCard } from '@/components/join/tier-card';

export const metadata: Metadata = {
  title: 'Join the RLC',
  description:
    'Become a member of the Republican Liberty Caucus and help advance liberty within the Republican Party.',
};

export default function JoinPage() {
  // Split tiers into two rows for display: first 4, then 3
  const primaryTiers = MEMBERSHIP_TIERS.slice(0, 4);
  const premiumTiers = MEMBERSHIP_TIERS.slice(4);

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-rlc-blue to-rlc-red py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold">Join the Republican Liberty Caucus</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-white/90">
            Stand with thousands of liberty-minded Republicans working to advance individual
            rights, limited government, and free markets within the GOP.
          </p>
        </div>
      </section>

      {/* Membership Tiers */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-2 text-center text-3xl font-bold">Choose Your Membership</h2>
          <p className="mb-10 text-center text-muted-foreground">
            All memberships are annual and include full voting rights.
          </p>

          {/* Primary tiers - 4 columns */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {primaryTiers.map((tier) => (
              <JoinTierCard key={tier.tier} tier={tier} />
            ))}
          </div>

          {/* Premium tiers */}
          <div className="mt-12">
            <h3 className="mb-6 text-center text-xl font-semibold text-muted-foreground">
              Leadership & Major Supporter Tiers
            </h3>
            <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
              {premiumTiers.map((tier) => (
                <JoinTierCard key={tier.tier} tier={tier} />
              ))}
            </div>
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
                  <Users className="h-8 w-8 text-rlc-red" />
                </div>
              </div>
              <h3 className="mb-2 text-xl font-semibold">Join a Community</h3>
              <p className="text-muted-foreground">
                Connect with like-minded Republicans who share your commitment to liberty
                and limited government.
              </p>
            </div>
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rlc-blue/10">
                  <Megaphone className="h-8 w-8 text-rlc-blue" />
                </div>
              </div>
              <h3 className="mb-2 text-xl font-semibold">Make Your Voice Heard</h3>
              <p className="text-muted-foreground">
                Participate in shaping the platform and direction of the Republican Party
                from within.
              </p>
            </div>
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rlc-gold/10">
                  <Star className="h-8 w-8 text-rlc-gold" />
                </div>
              </div>
              <h3 className="mb-2 text-xl font-semibold">Defend Liberty</h3>
              <p className="text-muted-foreground">
                Support candidates and policies that protect individual rights and limit
                government power.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16">
        <div className="container mx-auto max-w-3xl px-4">
          <h2 className="mb-8 text-center text-3xl font-bold">Common Questions</h2>
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-lg font-semibold">What does my membership include?</h3>
              <p className="text-muted-foreground">
                All membership levels include full voting rights at RLC conventions, member
                communications, state chapter membership, and an RLC membership card. Higher
                tiers include additional benefits like family membership and leadership access.
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-lg font-semibold">
                What&apos;s the difference between Premium and Sustaining?
              </h3>
              <p className="text-muted-foreground">
                Premium membership includes one spouse at no additional cost. Sustaining
                membership extends to your entire family — spouse and children — plus additional
                recognition and leadership access.
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-lg font-semibold">Can I upgrade my membership later?</h3>
              <p className="text-muted-foreground">
                Yes! You can upgrade your membership at any time from your member dashboard.
                The difference in price will be prorated for the remainder of your membership
                year.
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-lg font-semibold">Is my contribution tax-deductible?</h3>
              <p className="text-muted-foreground">
                The Republican Liberty Caucus is a 527 political organization. Membership dues
                are not tax-deductible as charitable contributions but may be deductible as a
                business expense. Consult your tax advisor.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
