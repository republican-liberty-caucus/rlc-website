import type { ScorecardBill } from '@/types';

interface BillExplanationsProps {
  bills: ScorecardBill[];
}

export function BillExplanations({ bills }: BillExplanationsProps) {
  const sortedBills = [...bills].sort((a, b) => a.sort_order - b.sort_order);

  if (sortedBills.length === 0) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        No bills have been scored in this session yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {sortedBills.length} bill{sortedBills.length !== 1 ? 's' : ''} scored in this session.
        The RLC position indicates whether the pro-liberty vote is{' '}
        <span className="font-medium text-green-700 dark:text-green-400">YEA</span> or{' '}
        <span className="font-medium text-red-700 dark:text-red-400">NAY</span>.
      </p>

      <div className="space-y-3">
        {sortedBills.map((bill, idx) => (
          <div key={bill.id} className="rounded-lg border bg-card p-5">
            <div className="flex flex-wrap items-start gap-3">
              <span className="text-sm text-muted-foreground">#{idx + 1}</span>
              <span
                className={`rounded-md px-2 py-0.5 font-mono text-sm font-semibold ${
                  bill.liberty_position === 'yea'
                    ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400'
                }`}
              >
                {bill.bill_number}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  bill.liberty_position === 'yea'
                    ? 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                }`}
              >
                RLC: Vote {bill.liberty_position.toUpperCase()}
              </span>
              {bill.is_bonus && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                  Bonus ({bill.bonus_point_value}pts)
                </span>
              )}
              {bill.weight !== 1 && !bill.is_bonus && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
                  Weight: {bill.weight}x
                </span>
              )}
            </div>

            <h4 className="mt-2 font-medium">{bill.title}</h4>

            {bill.description && (
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {bill.description}
              </p>
            )}

            {bill.vote_result_summary && (
              <p className="mt-2 text-xs text-muted-foreground">
                Result: {bill.vote_result_summary}
              </p>
            )}

            {bill.category && bill.category !== 'other' && (
              <span className="mt-3 inline-block rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
                {bill.category}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
