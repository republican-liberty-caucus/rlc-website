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
  let baseQuery = supabase.from('rlc_split_ledger_entries').select('amount, status, recipient_chapter_id, created_at');
  if (ctx.visibleChapterIds !== null) {
    baseQuery = baseQuery.in('recipient_chapter_id', ctx.visibleChapterIds);
  }

  const [entriesRes, accountsRes] = await Promise.all([
    baseQuery,
    ctx.visibleChapterIds !== null
      ? supabase.from('rlc_chapter_stripe_accounts').select('chapter_id, status').in('chapter_id', ctx.visibleChapterIds)
      : supabase.from('rlc_chapter_stripe_accounts').select('chapter_id, status'),
  ]);

  const rows = (entriesRes.data || []) as { amount: number; status: string; recipient_chapter_id: string; created_at: string }[];
  const accounts = (accountsRes.data || []) as { chapter_id: string; status: string }[];

  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  let totalDistributed = 0;
  let totalPending = 0;
  let monthlyDistributed = 0;
  const chapterTotals = new Map<string, number>();

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

    const current = chapterTotals.get(row.recipient_chapter_id) || 0;
    chapterTotals.set(row.recipient_chapter_id, current + amount);
  }

  const activeAccounts = accounts.filter((a) => a.status === 'active').length;

  // Get chapter names for top recipients
  const topChapterIds = [...chapterTotals.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([id]) => id);

  let topChapters: { id: string; name: string; total: number }[] = [];
  if (topChapterIds.length > 0) {
    const { data: chapters } = await supabase.from('rlc_chapters').select('id, name').in('id', topChapterIds);
    topChapters = (chapters || [])
      .map((c: { id: string; name: string }) => ({ ...c, total: chapterTotals.get(c.id) || 0 }))
      .sort((a: { total: number }, b: { total: number }) => b.total - a.total);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dues Sharing"
        description="Track revenue distribution to state and local chapters"
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
          description="Awaiting chapter onboarding"
        />
        <StatCard
          label="Connected Chapters"
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

      {/* Top Chapters */}
      {topChapters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Receiving Chapters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topChapters.map((chapter) => (
                <div key={chapter.id} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{chapter.name}</span>
                  <Badge variant="secondary">{formatCurrency(chapter.total)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
