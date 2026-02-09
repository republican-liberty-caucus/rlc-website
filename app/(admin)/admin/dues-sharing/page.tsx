import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAdminContext } from '@/lib/admin/permissions';
import { createServerClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Building2, Clock, FileText } from 'lucide-react';

export const metadata = { title: 'Dues Sharing - Admin' };

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function DuesSharingDashboard() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const supabase = createServerClient();

  // Fetch dashboard data
  let baseQuery = supabase.from('rlc_split_ledger_entries').select('amount, status, recipient_charter_id, created_at');
  if (ctx.visibleCharterIds !== null) {
    baseQuery = baseQuery.in('recipient_charter_id', ctx.visibleCharterIds);
  }

  const [entriesRes, accountsRes] = await Promise.all([
    baseQuery,
    ctx.visibleCharterIds !== null
      ? supabase.from('rlc_charter_stripe_accounts').select('charter_id, status').in('charter_id', ctx.visibleCharterIds)
      : supabase.from('rlc_charter_stripe_accounts').select('charter_id, status'),
  ]);

  const rows = (entriesRes.data || []) as { amount: number; status: string; recipient_charter_id: string; created_at: string }[];
  const accounts = (accountsRes.data || []) as { charter_id: string; status: string }[];

  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  let totalDistributed = 0;
  let totalPending = 0;
  let monthlyDistributed = 0;
  const charterTotals = new Map<string, number>();

  for (const row of rows) {
    const amount = Number(row.amount);
    if (amount < 0) continue;

    if (row.status === 'transferred') {
      totalDistributed += amount;
      if (row.created_at >= thisMonth) {
        monthlyDistributed += amount;
      }
    } else if (row.status === 'pending') {
      totalPending += amount;
    }

    const current = charterTotals.get(row.recipient_charter_id) || 0;
    charterTotals.set(row.recipient_charter_id, current + amount);
  }

  const activeAccounts = accounts.filter((a) => a.status === 'active').length;

  // Get charter names for top recipients
  const topCharterIds = [...charterTotals.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([id]) => id);

  let topCharters: { id: string; name: string; total: number }[] = [];
  if (topCharterIds.length > 0) {
    const { data: charters } = await supabase.from('rlc_charters').select('id, name').in('id', topCharterIds);
    topCharters = (charters || [])
      .map((c: { id: string; name: string }) => ({ ...c, total: charterTotals.get(c.id) || 0 }))
      .sort((a: { total: number }, b: { total: number }) => b.total - a.total);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dues Sharing"
        description="Track revenue distribution to state and local charters"
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Distributed"
          value={formatCurrency(totalDistributed)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          label="This Month"
          value={formatCurrency(monthlyDistributed)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          label="Pending Transfers"
          value={formatCurrency(totalPending)}
          icon={<Clock className="h-4 w-4" />}
          description="Awaiting charter onboarding"
        />
        <StatCard
          label="Connected Charters"
          value={`${activeAccounts} / ${accounts.length}`}
          icon={<Building2 className="h-4 w-4" />}
        />
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link href="/admin/dues-sharing/statements" className="block">
          <Card className="hover:border-primary transition-colors">
            <CardContent className="flex items-center gap-3 p-4">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Statements</p>
                <p className="text-sm text-muted-foreground">Monthly exports</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/dues-sharing/members" className="block">
          <Card className="hover:border-primary transition-colors">
            <CardContent className="flex items-center gap-3 p-4">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Member Detail</p>
                <p className="text-sm text-muted-foreground">Per-payment splits</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/dues-sharing/trends" className="block">
          <Card className="hover:border-primary transition-colors">
            <CardContent className="flex items-center gap-3 p-4">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Trends</p>
                <p className="text-sm text-muted-foreground">Historical data</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/dues-sharing/audit" className="block">
          <Card className="hover:border-primary transition-colors">
            <CardContent className="flex items-center gap-3 p-4">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Audit Trail</p>
                <p className="text-sm text-muted-foreground">Full ledger history</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Top Charters */}
      {topCharters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Receiving Charters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topCharters.map((charter) => (
                <div key={charter.id} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{charter.name}</span>
                  <Badge variant="secondary">{formatCurrency(charter.total)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
