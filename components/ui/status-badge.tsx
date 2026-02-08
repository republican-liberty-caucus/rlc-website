import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusType =
  | 'membership'
  | 'campaign'
  | 'scorecard'
  | 'chapter'
  | 'event'
  | 'payment'
  | 'survey'
  | 'post';

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: string;
  type: StatusType;
}

const statusColorMap: Record<StatusType, Record<string, string>> = {
  membership: {
    new_member: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    current: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
    grace: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    expired: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
    cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    deceased: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
    expiring: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  },
  campaign: {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    active: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  },
  scorecard: {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    active: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    published: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
    archived: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
  },
  chapter: {
    active: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
    inactive: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
    forming: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  },
  event: {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    published: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  },
  payment: {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
    completed: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
    failed: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
    refunded: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
    cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  },
  survey: {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    active: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
    closed: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  },
  post: {
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    published: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  },
};

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadge({ status, type, className, ...props }: StatusBadgeProps) {
  const colorMap = statusColorMap[type] || {};
  const colorClass =
    colorMap[status] ||
    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';

  return (
    <Badge
      variant="outline"
      className={cn('border-transparent', colorClass, className)}
      {...props}
    >
      {formatStatusLabel(status)}
    </Badge>
  );
}

export { StatusBadge, statusColorMap, formatStatusLabel };
export type { StatusBadgeProps, StatusType };
