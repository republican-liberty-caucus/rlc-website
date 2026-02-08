import Link from 'next/link';
import { ScoreBadge } from '@/components/ui/score-badge';
import { Trophy, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SpotlightLegislator {
  id: string;
  name: string;
  party: string;
  state_code: string;
  current_score: number | null;
}

interface ScorecardSpotlightProps {
  champions: SpotlightLegislator[];
  worstOffenders: SpotlightLegislator[];
  sessionName: string;
  sessionSlug: string;
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

export function ScorecardSpotlight({
  champions,
  worstOffenders,
  sessionName,
  sessionSlug,
}: ScorecardSpotlightProps) {
  if (champions.length === 0 && worstOffenders.length === 0) return null;

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-3xl font-bold">Liberty Scorecard</h2>
            <p className="mt-1 text-muted-foreground">{sessionName}</p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/scorecards/${sessionSlug}`}>View Full Scorecard</Link>
          </Button>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Champions */}
          {champions.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-rlc-red" />
                <h3 className="font-heading text-lg font-semibold">Liberty Champions</h3>
              </div>
              <div className="space-y-3">
                {champions.map((leg) => (
                  <div
                    key={leg.id}
                    className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-3"
                  >
                    <div>
                      <span className="font-medium">{leg.name}</span>
                      <span className={`ml-2 text-sm ${partyColor(leg.party)}`}>
                        ({partyLabel(leg.party)}-{leg.state_code})
                      </span>
                    </div>
                    <ScoreBadge score={leg.current_score ?? 0} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Worst Offenders */}
          {worstOffenders.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <ThumbsDown className="h-5 w-5 text-destructive" />
                <h3 className="font-heading text-lg font-semibold">Needs Improvement</h3>
              </div>
              <div className="space-y-3">
                {worstOffenders.map((leg) => (
                  <div
                    key={leg.id}
                    className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-3"
                  >
                    <div>
                      <span className="font-medium">{leg.name}</span>
                      <span className={`ml-2 text-sm ${partyColor(leg.party)}`}>
                        ({partyLabel(leg.party)}-{leg.state_code})
                      </span>
                    </div>
                    <ScoreBadge score={leg.current_score ?? 0} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
