import { Metadata } from 'next';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { createServerClient } from '@/lib/supabase/server';
import { AddressLookup } from '@/components/action-center/address-lookup';
import Link from 'next/link';
import type { ActionCampaign } from '@/types';

export const metadata: Metadata = {
  title: 'Action Center',
  description: 'Make your voice heard. Contact your representatives and take action on liberty issues.',
};

export default async function ActionCenterPage() {
  const supabase = createServerClient();

  const { data } = await supabase
    .from('rlc_action_campaigns')
    .select('id, title, slug, description, status')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(6);

  const campaigns = (data || []) as Pick<ActionCampaign, 'id' | 'title' | 'slug' | 'description' | 'status'>[];

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <section className="bg-gradient-to-br from-rlc-red to-rlc-red/80 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold">Make Your Voice Heard</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-white/90">
            Contact your elected officials and let them know where you stand on the issues that matter.
          </p>
        </div>
      </section>

      {/* Address Lookup */}
      <section className="bg-muted/30 py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-4 text-center text-2xl font-bold">Find Your Representatives</h2>
            <p className="mb-6 text-center text-muted-foreground">
              Enter your address to find your elected officials and their contact information.
            </p>
            <AddressLookup />
          </div>
        </div>
      </section>

      {/* Active Campaigns */}
      {campaigns.length > 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <h2 className="mb-6 text-2xl font-bold">Active Campaigns</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/action-center/contact?campaign=${campaign.slug}`}
                  className="rounded-lg border bg-card p-6 transition-shadow hover:shadow-md"
                >
                  <span className="mb-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                    Active
                  </span>
                  <h3 className="text-lg font-semibold">{campaign.title}</h3>
                  {campaign.description && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {campaign.description}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
