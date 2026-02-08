'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Rep {
  name: string;
  party: string;
  phones: string[];
  emails: string[];
  photoUrl: string | null;
  urls: string[];
  channels: Array<{ type: string; id: string }>;
  office: string;
}

interface MyRepsPreviewProps {
  memberAddress: string | null;
  memberState: string | null;
}

export function MyRepsPreview({ memberAddress, memberState }: MyRepsPreviewProps) {
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!memberAddress || fetched) return;

    let cancelled = false;
    setLoading(true);

    fetch(`/api/v1/civic/representatives?address=${encodeURIComponent(memberAddress)}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Representatives API returned ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data.officials) {
          setReps(data.officials.slice(0, 4));
        }
      })
      .catch((err) => {
        console.error('[MyRepsPreview] Failed to fetch representatives:', err);
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setFetched(true);
        }
      });

    return () => { cancelled = true; };
  }, [memberAddress, fetched]);

  // No address on file
  if (!memberAddress) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-heading text-lg font-semibold">Your Representatives</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Add your address to your profile to see your elected officials and their liberty scores.
        </p>
        <Button asChild size="sm" variant="outline" className="mt-3">
          <Link href="/profile">Update Address</Link>
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-heading text-lg font-semibold">Your Representatives</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Unable to load your representatives right now. Please try again later.
        </p>
        <Button asChild size="sm" variant="outline" className="mt-3">
          <Link href="/action-center/contact">Find Your Reps Manually</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-heading text-lg font-semibold">Your Representatives</h2>
        </div>
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-heading text-lg font-semibold">Your Representatives</h2>
        </div>
        {memberState && (
          <span className="text-xs text-muted-foreground">{memberState}</span>
        )}
      </div>
      {reps.length > 0 ? (
        <div className="mt-4 space-y-3">
          {reps.map((rep, idx) => (
            <div
              key={`${rep.name}-${idx}`}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{rep.name}</p>
                  <span className="text-xs text-muted-foreground">({rep.party})</span>
                </div>
                <p className="text-xs text-muted-foreground">{rep.office}</p>
              </div>
              <div className="flex items-center gap-2">
                {rep.phones[0] && (
                  <a
                    href={`tel:${rep.phones[0]}`}
                    className="text-xs text-rlc-blue hover:underline"
                  >
                    {rep.phones[0]}
                  </a>
                )}
                {rep.urls[0] && (
                  <a
                    href={rep.urls[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : fetched ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No representatives found for your address. Try updating your address in your profile.
        </p>
      ) : null}
      <Button asChild size="sm" variant="outline" className="mt-4">
        <Link href="/action-center/contact">Contact Your Reps</Link>
      </Button>
    </div>
  );
}
