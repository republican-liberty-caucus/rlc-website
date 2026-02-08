import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  count?: number;
  description?: string;
  action?: React.ReactNode;
}

function PageHeader({
  title,
  count,
  description,
  action,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
      {...props}
    >
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {count !== undefined && (
            <Badge variant="secondary" className="font-mono">
              {count.toLocaleString()}
            </Badge>
          )}
        </div>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export { PageHeader };
export type { PageHeaderProps };
