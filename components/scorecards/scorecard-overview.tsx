import type { ScorecardSession } from '@/types';

const chamberNames: Record<string, string> = {
  us_house: 'U.S. House of Representatives',
  us_senate: 'U.S. Senate',
  state_house: 'State House',
  state_senate: 'State Senate',
};

interface ScorecardOverviewProps {
  session: ScorecardSession;
  billCount: number;
  legislatorCount: number;
}

export function ScorecardOverview({ session, billCount, legislatorCount }: ScorecardOverviewProps) {
  const chamberName = session.chamber ? chamberNames[session.chamber] || session.chamber : null;

  return (
    <div className="space-y-8">
      {/* Overview text */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 font-heading text-xl font-semibold">About This Scorecard</h3>
        {session.description ? (
          <div className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
            {session.description}
          </div>
        ) : (
          <p className="text-muted-foreground leading-relaxed">
            The {session.name} Liberty Scorecard rates members of
            {chamberName ? ` the ${chamberName}` : ' Congress'} based on
            key votes on issues of individual liberty, limited government,
            free markets, and constitutional governance.
          </p>
        )}
      </div>

      {/* Session details + scoring guide */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 font-heading text-lg font-semibold">Session Details</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Session</dt>
              <dd className="font-medium">{session.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Year</dt>
              <dd className="font-medium">{session.session_year}</dd>
            </div>
            {chamberName && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Chamber</dt>
                <dd className="font-medium">{chamberName}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Jurisdiction</dt>
              <dd className="font-medium capitalize">{session.jurisdiction}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Bills Scored</dt>
              <dd className="font-medium">{billCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Legislators Rated</dt>
              <dd className="font-medium">{legislatorCount}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 font-heading text-lg font-semibold">Scoring Guide</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Each legislator&apos;s <strong className="text-foreground">Liberty Score</strong> is
              calculated from their votes on bills selected by the RLC based on their
              impact on individual liberty and limited government.
            </p>
            <p>
              Votes aligned with the RLC position earn credit. Absences beyond
              {' '}{session.absence_penalty_threshold} are counted against the legislator.
              Bonus points may be awarded for sponsorship of key legislation.
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
                <span>80-100%: Strong defender of liberty</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" />
                <span>60-79%: Mixed record</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-orange-500" />
                <span>40-59%: Needs improvement</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
                <span>0-39%: Opposed to liberty agenda</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
