import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import type { ExpiringMember } from '@/lib/reports/fetch-report-data';

interface ExpiringMembersTableProps {
  members: ExpiringMember[];
}

export function ExpiringMembersTable({ members }: ExpiringMembersTableProps) {
  if (members.length === 0) return null;

  return (
    <Card className="lg:col-span-2">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">
            Expiring Members (Next 30 Days)
          </h2>
          <Link
            href="/admin/members?status=expiring"
            className="text-sm font-medium text-rlc-red hover:underline"
          >
            View all {members.length === 20 ? '20+' : members.length} &rarr;
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left text-sm font-medium">Name</th>
                <th className="py-2 text-left text-sm font-medium">Email</th>
                <th className="py-2 text-left text-sm font-medium">Phone</th>
                <th className="py-2 text-right text-sm font-medium">Expires</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="py-2 text-sm">
                    <Link
                      href={`/admin/members/${m.id}`}
                      className="font-medium text-rlc-blue hover:underline"
                    >
                      {m.first_name} {m.last_name}
                    </Link>
                  </td>
                  <td className="py-2 text-sm text-muted-foreground">{m.email}</td>
                  <td className="py-2 text-sm text-muted-foreground">
                    {m.phone || '\u2014'}
                  </td>
                  <td className="py-2 text-right text-sm">
                    {m.membership_expiry_date
                      ? new Date(m.membership_expiry_date).toLocaleDateString()
                      : '\u2014'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
