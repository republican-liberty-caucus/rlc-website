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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Database type doesn't include RPC function signatures
function rpc(supabase: any, fn: string, args: Record<string, unknown>) {
  return supabase.rpc(fn, args);
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function DuesSharingDashboard() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const supabase = createServerClient();
  const charterIds = ctx.visibleCharterIds;

  const [summaryRes, topChartersRes, accountsRes] = await Promise.all([
    rpc(supabase, 'get_ledger_summary', { p_charter_ids: charterIds }),
    rpc(supabase, 'get_top_receiving_charters', { p_charter_ids: charterIds, p_limit: 10 }),
    charterIds !== null
      ? supabase.from('rlc_charter_stripe_accounts').select('charter_id, status').in('charter_id', charterIds)
      : supabase.from('rlc_charter_stripe_accounts').select('charter_id, status'),
  ]);

  const summary = (summaryRes.data?.[0] ?? {
    total_distributed: 0,
    total_pending: 0,
    monthly_distributed: 0,
    entry_count: 0,
  }) as { total_distributed: number; total_pending: number; monthly_distributed: number; entry_count: number };

  const topCharters = ((topChartersRes.data ?? []) as { charter_id: string; charter_name: string; total_amount: number }[])
    .map((r) => ({ id: r.charter_id, name: r.charter_name, total: Number(r.total_amount) }));

  const accounts = (accountsRes.data || []) as { charter_id: string; status: string }[];
  const activeAccounts = accounts.filter((a) => a.status === 'active').length;

  const totalDistributed = Number(summary.total_distributed);
  const totalPending = Number(summary.total_pending);
  const monthlyDistributed = Number(summary.monthly_distributed);

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
