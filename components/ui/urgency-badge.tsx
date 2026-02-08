import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  isPast,
} from 'date-fns';

interface UrgencyBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  deadline: string | Date;
  label?: string;
}

function getTimeRemaining(deadline: Date): {
  text: string;
  urgency: 'critical' | 'warning' | 'normal' | 'expired';
} {
  if (isPast(deadline)) {
    return { text: 'Expired', urgency: 'expired' };
  }

  const days = differenceInDays(deadline, new Date());
  const hours = differenceInHours(deadline, new Date());
  const minutes = differenceInMinutes(deadline, new Date());

  if (days > 7) {
    return { text: `${days}d left`, urgency: 'normal' };
  }
  if (days > 2) {
    return { text: `${days}d left`, urgency: 'warning' };
  }
  if (hours > 1) {
    return { text: `${hours}h left`, urgency: 'critical' };
  }
  return { text: `${minutes}m left`, urgency: 'critical' };
}

const urgencyColors = {
  critical:
    'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 animate-pulse-urgent',
  warning:
    'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  normal:
    'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  expired:
    'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

function UrgencyBadge({
  deadline,
  label,
  className,
  ...props
}: UrgencyBadgeProps) {
  const deadlineDate =
    deadline instanceof Date ? deadline : new Date(deadline);
  const { text, urgency } = getTimeRemaining(deadlineDate);

  return (
    <Badge
      variant="outline"
      className={cn(
        'border-transparent',
        urgencyColors[urgency],
        className
      )}
      {...props}
    >
      {label ? `${label}: ${text}` : text}
    </Badge>
  );
}

export { UrgencyBadge, getTimeRemaining };
export type { UrgencyBadgeProps };
