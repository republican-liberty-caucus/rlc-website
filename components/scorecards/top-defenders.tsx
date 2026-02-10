import Image from 'next/image';
import Link from 'next/link';
import { Trophy, ThumbsDown } from 'lucide-react';
import { ScoreBadge, getScoreColor } from '@/components/ui/score-badge';
import type { ScoredLegislator } from '@/types';

interface TopDefendersProps {
  topScorers: ScoredLegislator[];
  bottomScorers: ScoredLegislator[];
  averageScore: number | null;
  scorecardSlug: string;
}

function partyLabel(party: string): string {
  switch (party.toLowerCase()) {
    case 'r':
    case 'republican':
      return 'R';
    case 'd':
    case 'democrat':
      return 'D';
    default:
      return party.charAt(0).toUpperCase();
  }
}

function partyColor(party: string): string {
  switch (party.toLowerCase()) {
    case 'r':
    case 'republican':
      return 'text-red-600';
    case 'd':
    case 'democrat':
      return 'text-blue-600';
    default:
      return 'text-muted-foreground';
  }
}

export function TopDefenders({ topScorers, bottomScorers, averageScore, scorecardSlug }: TopDefendersProps) {
  return (
    <div className="space-y-8">
      {/* Average score bar */}
      {averageScore !== null && (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading text-lg font-semibold">Average Republican Score</h3>
              <p className="text-sm text-muted-foreground">Across all rated legislators</p>
            </div>
            <ScoreBadge score={averageScore} size="lg" />
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${getScoreColor(averageScore).bar}`}
              style={{ width: `${Math.min(100, Math.max(0, averageScore))}%` }}
            />
          </div>
        </div>
      )}

      {/* Top Defenders */}
      {topScorers.length > 0 && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-rlc-red" />
            <h3 className="font-heading text-xl font-semibold">Top Defenders of Liberty</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {topScorers.map((leg) => (
              <Link
                key={leg.id}
                href={`/scorecards/${scorecardSlug}/${leg.id}`}
                className="group rounded-lg border bg-card p-4 text-center transition-shadow hover:shadow-md"
              >
                <div className="mx-auto mb-3 h-16 w-16 overflow-hidden rounded-full bg-muted">
                  {leg.photo_url ? (
                    <Image
                      src={leg.photo_url}
                      alt={leg.name}
                      width={64}
                      height={64}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-bold text-muted-foreground">
                      {leg.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                  )}
                </div>
                <p className="text-sm font-semibold group-hover:text-rlc-blue">{leg.name}</p>
                <p className={`text-xs ${partyColor(leg.party)}`}>
                  ({partyLabel(leg.party)}-{leg.state_code})
                </p>
                <div className="mt-2">
                  <ScoreBadge score={leg.computed_score} size="sm" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Scorers */}
      {bottomScorers.length > 0 && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <ThumbsDown className="h-5 w-5 text-destructive" />
            <h3 className="font-heading text-xl font-semibold">Lowest Scoring Legislators</h3>
          </div>
          <div className="rounded-lg border bg-card">
            <div className="divide-y">
              {bottomScorers.map((leg, idx) => (
                <Link
                  key={leg.id}
                  href={`/scorecards/${scorecardSlug}/${leg.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-sm text-muted-foreground">{idx + 1}</span>
                    <div>
                      <span className="text-sm font-medium">{leg.name}</span>
                      <span className={`ml-2 text-xs ${partyColor(leg.party)}`}>
                        ({partyLabel(leg.party)}-{leg.state_code})
                      </span>
                    </div>
                  </div>
                  <ScoreBadge score={leg.computed_score} size="sm" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
