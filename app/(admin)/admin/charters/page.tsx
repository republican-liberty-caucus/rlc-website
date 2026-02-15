import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, ExternalLink } from 'lucide-react';
import type { Charter } from '@/types';

export const metadata: Metadata = {
  title: 'Charters - Admin',
  description: 'Manage RLC charters',
};

interface CharterWithCount extends Charter {
  memberCount: number;
}

async function getCharters(visibleCharterIds: string[] | null): Promise<CharterWithCount[]> {
  const supabase = createServerClient();

  let query = supabase
    .from('rlc_charters')
    .select('*')
    .order('name');

  if (visibleCharterIds !== null && visibleCharterIds.length > 0) {
    query = query.in('id', visibleCharterIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch charters: ${error.message}`);
  }
  const charters = (data || []) as Charter[];

  if (charters.length === 0) return [];

  // Single query for all member counts (avoids N+1)
  const { data: memberRows, error: memberCountError } = await supabase
    .from('rlc_contacts')
    .select('primary_charter_id')
    .in('primary_charter_id', charters.map((c) => c.id));

  if (memberCountError) {
    throw new Error(`Failed to fetch member counts: ${memberCountError.message}`);
  }

  const countMap: Record<string, number> = {};
  for (const row of (memberRows || []) as { primary_charter_id: string }[]) {
    countMap[row.primary_charter_id] = (countMap[row.primary_charter_id] || 0) + 1;
  }

  return charters.map((charter) => ({
    ...charter,
    memberCount: countMap[charter.id] || 0,
  }));
}

export default async function AdminChartersPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const charters = await getCharters(ctx.visibleCharterIds);

  return (
    <div>
      <PageHeader
        title="Charters"
        count={charters.length}
        className="mb-8"
        action={
          ctx.isNational ? (
            <Button className="bg-rlc-red hover:bg-rlc-red/90">
              <Plus className="mr-2 h-4 w-4" />
              Add Charter
            </Button>
          ) : undefined
        }
      />

      {/* Charters Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {charters.map((charter) => (
          <Card key={charter.id}>
            <CardContent className="p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-heading font-semibold">{charter.name}</h3>
                {charter.state_code && (
                  <p className="text-sm text-muted-foreground">{charter.state_code}</p>
                )}
              </div>
              <StatusBadge status={charter.status} type="charter" />
            </div>

            <div className="mb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Members</span>
                <span className="font-medium">{charter.memberCount}</span>
              </div>
              {charter.contact_email && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contact</span>
                  <a
                    href={`mailto:${charter.contact_email}`}
                    className="text-rlc-red hover:underline"
                  >
                    {charter.contact_email}
                  </a>
                </div>
              )}
              {charter.website_url && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Website</span>
                  <a
                    href={charter.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-rlc-red hover:underline"
                  >
                    Visit
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Link
                href={`/admin/charters/${charter.id}`}
                className="flex-1"
              >
                <Button variant="outline" size="sm" className="w-full">
                  Edit
                </Button>
              </Link>
              <Link
                href={`/charters/${charter.slug}`}
                target="_blank"
              >
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {charters.length === 0 && (
        <div className="rounded-lg border bg-muted/50 p-12 text-center">
          <h2 className="mb-4 text-xl font-semibold">No Charters</h2>
          <p className="mb-6 text-muted-foreground">
            {ctx.isNational
              ? 'Get started by creating your first charter.'
              : 'No charters are assigned to your admin scope.'}
          </p>
        </div>
      )}
    </div>
  );
}
