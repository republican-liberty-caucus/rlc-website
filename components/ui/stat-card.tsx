import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type TrendDirection = 'up' | 'down' | 'neutral';

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    direction: TrendDirection;
  };
  description?: string;
}

const trendColors: Record<TrendDirection, string> = {
  up: 'text-green-600',
  down: 'text-red-600',
  neutral: 'text-muted-foreground',
};

const trendArrows: Record<TrendDirection, string> = {
  up: '\u2191',
  down: '\u2193',
  neutral: '\u2192',
};

function StatCard({
  label,
  value,
  icon,
  trend,
  description,
  className,
  ...props
}: StatCardProps) {
  return (
    <Card className={cn('', className)} {...props}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {icon && (
            <div className="text-muted-foreground">{icon}</div>
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <p className="font-heading text-3xl font-bold tracking-tight">
            {value}
          </p>
          {trend && (
            <span
              className={cn(
                'text-sm font-medium',
                trendColors[trend.direction]
              )}
            >
              {trendArrows[trend.direction]} {trend.value}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export { StatCard };
export type { StatCardProps, TrendDirection };
