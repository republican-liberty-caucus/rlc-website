import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getMemberByClerkId } from '@/lib/supabase/server';
import { createServerClient } from '@/lib/supabase/server';
import { formatDate, formatCurrency } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { CreditCard } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contributions',
  description: 'View your RLC contribution history',
};

interface ContributionRow {
  id: string;
  contribution_type: string;
  amount: number;
  currency: string;
  payment_status: string;
  is_recurring: boolean;
  created_at: string;
}

async function getContributions(memberId: string): Promise<ContributionRow[]> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from('rlc_contributions')
      .select('*')
      .eq('contact_id', memberId)
      .order('created_at', { ascending: false });

    return (data || []) as ContributionRow[];
  } catch {
    return [];
  }
}

export default async function ContributionsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const member = await getMemberByClerkId(userId);

  if (!member) {
    redirect('/dashboard');
  }

  const contributions = await getContributions(member.id);

  const totalContributions = contributions
    .filter((c) => c.payment_status === 'completed')
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const contributionTypeLabels: Record<string, string> = {
    membership: 'Membership',
    donation: 'Donation',
    event_registration: 'Event Registration',
    merchandise: 'Merchandise',
  };

  const statusColors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">Contributions</h1>
          <p className="mt-2 text-muted-foreground">
            View your donation and payment history.
          </p>
        </div>
        <Button asChild className="bg-rlc-red hover:bg-rlc-red/90">
          <Link href="/donate">Make a Donation</Link>
        </Button>
      </div>

      {/* Summary Card */}
      <div className="mb-8 rounded-lg border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Total Contributions</p>
            <p className="text-2xl font-bold">{formatCurrency(totalContributions)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Number of Contributions</p>
            <p className="text-2xl font-bold">{contributions.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Member Since</p>
            <p className="text-2xl font-bold">
              {member.membership_start_date
                ? formatDate(member.membership_start_date)
                : formatDate(member.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Contributions List */}
      {contributions.length > 0 ? (
        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {contributions.map((contribution) => (
                  <tr key={contribution.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-sm">
                      {formatDate(contribution.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {contributionTypeLabels[contribution.contribution_type] ||
                        contribution.contribution_type}
                      {contribution.is_recurring && (
                        <span className="ml-2 rounded bg-rlc-blue/10 px-1.5 py-0.5 text-xs text-rlc-blue">
                          Recurring
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {formatCurrency(Number(contribution.amount), contribution.currency)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${
                          statusColors[contribution.payment_status] || 'bg-gray-100'
                        }`}
                      >
                        {contribution.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<CreditCard className="h-12 w-12" />}
          title="No Contributions Yet"
          description="Your contribution history will appear here once you make a donation or payment."
          action={{ label: 'Make Your First Donation', href: '/donate' }}
        />
      )}
    </div>
  );
}
