'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';

interface PendingCandidate {
  id: string;
  candidate_name: string;
  candidate_office: string | null;
  candidate_state: string | null;
  candidate_district: string | null;
  total_score: number | null;
  submitted_at: string | null;
  survey: { id: string; title: string } | null;
}

interface PendingSubmissionsProps {
  candidates: PendingCandidate[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function PendingSubmissions({ candidates }: PendingSubmissionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [startingId, setStartingId] = useState<string | null>(null);

  async function handleStartVetting(candidateResponseId: string) {
    setStartingId(candidateResponseId);
    try {
      const res = await fetch('/api/v1/admin/vetting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateResponseId }),
        signal: AbortSignal.timeout(15000),
      });
      let data: { error?: string; vetting?: { candidate_name?: string } } | null = null;
      try {
        data = await res.json();
      } catch {
        // Response body is not JSON (e.g., proxy error page)
      }
      if (!res.ok) {
        toast({ title: 'Error', description: data?.error || `Server returned ${res.status}`, variant: 'destructive' });
        return;
      }
      toast({ title: 'Vetting Started', description: `Vetting created for ${data?.vetting?.candidate_name || 'candidate'}` });
      router.refresh();
    } catch (err) {
      console.error('Failed to start vetting:', err);
      const message = err instanceof Error ? err.message : 'Failed to start vetting';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setStartingId(null);
    }
  }

  return (
    <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="mb-3 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          Pending Review ({candidates.length})
        </h2>
        <span className="text-xs text-amber-600 dark:text-amber-400">
          Questionnaire submissions ready for vetting
        </span>
      </div>

      <div className="space-y-2">
        {candidates.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-md border border-amber-200 bg-white px-4 py-3 dark:border-amber-800 dark:bg-card"
          >
            <div className="flex items-center gap-4">
              <div>
                <p className="font-medium">{c.candidate_name}</p>
                <p className="text-sm text-muted-foreground">
                  {[c.candidate_office, c.candidate_state, c.candidate_district]
                    .filter(Boolean)
                    .join(' - ')}
                </p>
              </div>
              {c.total_score !== null && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.total_score >= 80
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : c.total_score >= 60
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  }`}
                >
                  {c.total_score}%
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {c.submitted_at ? formatDate(c.submitted_at) : ''}
              </span>
              <Button
                size="sm"
                onClick={() => handleStartVetting(c.id)}
                disabled={startingId === c.id}
                className="gap-1 bg-green-600 hover:bg-green-700"
              >
                <Play className="h-3 w-3" />
                {startingId === c.id ? 'Starting...' : 'Start Vetting'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
