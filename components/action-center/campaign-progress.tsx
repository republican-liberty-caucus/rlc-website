import { Progress } from '@/components/ui/progress';
import { Users } from 'lucide-react';

interface CampaignProgressProps {
  participationCount: number;
  goal?: number;
}

export function CampaignProgress({ participationCount, goal = 50 }: CampaignProgressProps) {
  const percentage = Math.min(Math.round((participationCount / goal) * 100), 100);

  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {participationCount} {participationCount === 1 ? 'person' : 'people'} took action
        </span>
        <span>{percentage}%</span>
      </div>
      <Progress value={percentage} className="h-1.5" />
    </div>
  );
}
