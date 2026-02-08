import * as React from 'react';
import { cn } from '@/lib/utils';

interface ScoreBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  score: number | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

function getGrade(score: number): string {
  if (score >= 93) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 77) return 'B+';
  if (score >= 73) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 67) return 'C+';
  if (score >= 63) return 'C';
  if (score >= 60) return 'C-';
  if (score >= 57) return 'D+';
  if (score >= 53) return 'D';
  if (score >= 50) return 'D-';
  return 'F';
}

function getScoreColor(score: number): {
  bg: string;
  text: string;
  bar: string;
} {
  if (score >= 80)
    return {
      bg: 'bg-green-100 dark:bg-green-950',
      text: 'text-green-700 dark:text-green-400',
      bar: 'bg-green-500',
    };
  if (score >= 60)
    return {
      bg: 'bg-yellow-100 dark:bg-yellow-950',
      text: 'text-yellow-700 dark:text-yellow-400',
      bar: 'bg-yellow-500',
    };
  if (score >= 40)
    return {
      bg: 'bg-orange-100 dark:bg-orange-950',
      text: 'text-orange-700 dark:text-orange-400',
      bar: 'bg-orange-500',
    };
  return {
    bg: 'bg-red-100 dark:bg-red-950',
    text: 'text-red-700 dark:text-red-400',
    bar: 'bg-red-500',
  };
}

const sizeClasses = {
  sm: 'h-6 min-w-[2.5rem] px-1.5 text-xs',
  md: 'h-8 min-w-[3rem] px-2 text-sm',
  lg: 'h-10 min-w-[3.5rem] px-3 text-base',
};

function ScoreBadge({
  score,
  size = 'md',
  showLabel = true,
  className,
  ...props
}: ScoreBadgeProps) {
  if (score === null) {
    return (
      <div
        className={cn(
          'inline-flex items-center justify-center rounded-md bg-muted font-semibold text-muted-foreground',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        N/A
      </div>
    );
  }

  const colors = getScoreColor(score);
  const grade = getGrade(score);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-semibold',
        colors.bg,
        colors.text,
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <span>{Math.round(score)}%</span>
      {showLabel && <span className="font-bold">{grade}</span>}
    </div>
  );
}

export { ScoreBadge, getGrade, getScoreColor };
export type { ScoreBadgeProps };
