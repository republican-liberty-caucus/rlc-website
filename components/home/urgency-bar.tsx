import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

interface UrgencyBarProps {
  activeCampaignCount: number;
}

export function UrgencyBar({ activeCampaignCount }: UrgencyBarProps) {
  if (activeCampaignCount === 0) return null;

  return (
    <div className="bg-rlc-red/95 text-white">
      <div className="container mx-auto flex items-center justify-center gap-2 px-4 py-2.5">
        <AlertTriangle className="h-4 w-4 animate-pulse-urgent" />
        <p className="text-sm font-medium">
          {activeCampaignCount} active {activeCampaignCount === 1 ? 'campaign needs' : 'campaigns need'} your voice this week
        </p>
        <Link
          href="/action-center"
          className="ml-2 rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold hover:bg-white/30 transition-colors"
        >
          Take Action →
        </Link>
      </div>
    </div>
  );
}
