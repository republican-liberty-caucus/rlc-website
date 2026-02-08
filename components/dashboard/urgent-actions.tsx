import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Campaign {
  id: string;
  title: string;
  slug: string;
  description: string | null;
}

interface UrgentActionsProps {
  campaigns: Campaign[];
}

export function UrgentActions({ campaigns }: UrgentActionsProps) {
  if (campaigns.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-rlc-red/20 bg-rlc-red/5 p-6">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-rlc-red" />
        <h2 className="font-heading text-lg font-semibold">Take Action</h2>
      </div>
      <div className="space-y-3">
        {campaigns.map((campaign) => (
          <Link
            key={campaign.id}
            href={`/action-center/contact?campaign=${campaign.slug}`}
            className="group flex items-center justify-between rounded-lg border border-rlc-red/10 bg-card p-4 transition-colors hover:border-rlc-red"
          >
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold group-hover:text-rlc-red">{campaign.title}</h3>
              {campaign.description && (
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {campaign.description}
                </p>
              )}
            </div>
            <ArrowRight className="ml-3 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-rlc-red" />
          </Link>
        ))}
      </div>
      <Button asChild size="sm" variant="outline" className="mt-4">
        <Link href="/action-center">View All Campaigns</Link>
      </Button>
    </div>
  );
}
