import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Megaphone, Users } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface CampaignWithCount {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  participation_count: number;
}

interface CampaignGridProps {
  campaigns: CampaignWithCount[];
}

export function CampaignGrid({ campaigns }: CampaignGridProps) {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="font-heading text-3xl font-bold">Active Campaigns</h2>
          <Button asChild variant="outline">
            <Link href="/action-center">View All</Link>
          </Button>
        </div>

        {campaigns.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/action-center/contact?campaign=${campaign.slug}`}
                className="group rounded-lg border bg-card p-6 transition-all hover:border-rlc-red hover:shadow-md"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-rlc-red" />
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                    Active
                  </span>
                </div>
                <h3 className="mb-2 font-heading text-lg font-semibold group-hover:text-rlc-red">
                  {campaign.title}
                </h3>
                {campaign.description && (
                  <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                    {campaign.description}
                  </p>
                )}
                <div className="mt-auto">
                  <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {campaign.participation_count} {campaign.participation_count === 1 ? 'person' : 'people'} took action
                    </span>
                  </div>
                  <Progress
                    value={Math.min(campaign.participation_count * 2, 100)}
                    className="h-1.5"
                  />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Active Campaigns"
            description="Stay tuned — new campaigns are launched regularly."
            action={{ label: 'Browse Scorecards', href: '/scorecards' }}
            icon={<Megaphone className="h-12 w-12" />}
          />
        )}
      </div>
    </section>
  );
}
