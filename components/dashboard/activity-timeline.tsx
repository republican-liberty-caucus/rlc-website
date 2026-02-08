import { formatDistanceToNow } from 'date-fns';
import { Megaphone, CreditCard, Calendar, Vote } from 'lucide-react';
import Link from 'next/link';

export interface ActivityItem {
  id: string;
  type: 'campaign' | 'contribution' | 'event' | 'scorecard';
  title: string;
  description: string;
  timestamp: string;
  href?: string;
}

interface ActivityTimelineProps {
  items: ActivityItem[];
}

const typeConfig: Record<ActivityItem['type'], { icon: React.ReactNode; color: string }> = {
  campaign: {
    icon: <Megaphone className="h-4 w-4" />,
    color: 'bg-rlc-red/10 text-rlc-red',
  },
  contribution: {
    icon: <CreditCard className="h-4 w-4" />,
    color: 'bg-green-100 text-green-700',
  },
  event: {
    icon: <Calendar className="h-4 w-4" />,
    color: 'bg-rlc-blue/10 text-rlc-blue',
  },
  scorecard: {
    icon: <Vote className="h-4 w-4" />,
    color: 'bg-purple-100 text-purple-700',
  },
};

export function ActivityTimeline({ items }: ActivityTimelineProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-heading text-lg font-semibold">Recent Activity</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your activity will appear here as you engage with campaigns, events, and more.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="mb-4 font-heading text-lg font-semibold">Recent Activity</h2>
      <div className="space-y-4">
        {items.map((item) => {
          const config = typeConfig[item.type];
          const content = (
            <div className="flex gap-3">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.color}`}>
                {config.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {(() => {
                    const date = new Date(item.timestamp);
                    return isNaN(date.getTime()) ? 'Recently' : formatDistanceToNow(date, { addSuffix: true });
                  })()}
                </p>
              </div>
            </div>
          );

          return item.href ? (
            <Link
              key={item.id}
              href={item.href}
              className="block rounded-lg p-2 transition-colors hover:bg-muted/50"
            >
              {content}
            </Link>
          ) : (
            <div key={item.id} className="p-2">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
