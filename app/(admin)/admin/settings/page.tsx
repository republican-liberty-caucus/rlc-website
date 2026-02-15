import { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { MEMBERSHIP_TIERS } from '@/lib/stripe/client';

export const metadata: Metadata = {
  title: 'Settings - Admin',
  description: 'RLC admin settings',
};

export default function AdminSettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Manage organization settings and integrations.
        </p>
      </div>

      <div className="space-y-8">
        {/* Organization Settings */}
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Organization</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Organization Name
              </label>
              <input
                type="text"
                defaultValue="Republican Liberty Caucus"
                className="w-full max-w-md rounded-md border bg-background px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Contact Email
              </label>
              <input
                type="email"
                defaultValue="info@rlc.org"
                className="w-full max-w-md rounded-md border bg-background px-3 py-2"
              />
            </div>
          </div>
        </section>

        {/* Membership Tiers */}
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Membership Tiers</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Annual membership pricing by tier. All memberships are billed yearly.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MEMBERSHIP_TIERS.map((tier) => (
              <div key={tier.tier}>
                <label className="mb-1 block text-sm font-medium">
                  {tier.name}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <input
                    type="number"
                    defaultValue={tier.price / 100}
                    className="w-full rounded-md border bg-background pl-8 pr-3 py-2"
                    readOnly
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{tier.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Integrations */}
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Integrations</h2>
          <div className="space-y-6">
            {/* HighLevel */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <h3 className="font-medium">HighLevel CRM</h3>
                <p className="text-sm text-muted-foreground">
                  Sync members and contacts with HighLevel
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                  Connected
                </span>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>
            </div>

            {/* Stripe */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <h3 className="font-medium">Stripe Payments</h3>
                <p className="text-sm text-muted-foreground">
                  Process donations and membership payments
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                  Connected
                </span>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>
            </div>

            {/* Resend */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <h3 className="font-medium">Resend Email</h3>
                <p className="text-sm text-muted-foreground">
                  Send transactional and marketing emails
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                  Not Configured
                </span>
                <Button variant="outline" size="sm">
                  Connect
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button className="bg-rlc-red hover:bg-rlc-red/90">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
