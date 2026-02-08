import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';

interface MemberContextBadgeProps {
  label: string;
  variant?: 'participated' | 'registered' | 'your-rep';
}

const variantStyles = {
  participated: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400',
  registered: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400',
  'your-rep': 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-400',
};

export function MemberContextBadge({ label, variant = 'participated' }: MemberContextBadgeProps) {
  return (
    <Badge variant="outline" className={`border-transparent text-xs ${variantStyles[variant]}`}>
      <Check className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  );
}
