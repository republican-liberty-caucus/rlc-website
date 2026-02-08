'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/hooks/use-toast';

interface RegistrationButtonProps {
  eventId: string;
  eventSlug: string;
  maxAttendees: number | null;
  currentCount: number;
  registrationDeadline: string | null;
  registrationFee: number | null;
}

export function RegistrationButton({
  eventId,
  eventSlug,
  maxAttendees,
  currentCount,
  registrationDeadline,
  registrationFee,
}: RegistrationButtonProps) {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [registering, setRegistering] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');

  const isPastDeadline = registrationDeadline && new Date(registrationDeadline) < new Date();
  const isFull = maxAttendees !== null && currentCount >= maxAttendees;

  if (isPastDeadline) {
    return <p className="text-sm font-medium text-red-600">Registration has closed.</p>;
  }

  if (isFull) {
    return <p className="text-sm font-medium text-red-600">This event is full.</p>;
  }

  async function handleRegister(asGuest: boolean) {
    setRegistering(true);

    try {
      const body: Record<string, string> = { eventId };
      if (asGuest) {
        if (!guestName.trim() || !guestEmail.trim()) {
          toast({ title: 'Error', description: 'Name and email are required.', variant: 'destructive' });
          setRegistering(false);
          return;
        }
        body.guestName = guestName.trim();
        body.guestEmail = guestEmail.trim();
      }

      const res = await fetch(`/api/v1/events/${eventId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let msg = 'Registration failed';
        try {
          const err = await res.json();
          msg = err.error || msg;
        } catch {
          // non-JSON response
        }
        throw new Error(msg);
      }

      toast({ title: 'Registered!', description: 'You have been registered for this event.' });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Registration failed',
        variant: 'destructive',
      });
    } finally {
      setRegistering(false);
    }
  }

  if (isSignedIn) {
    return (
      <Button
        onClick={() => handleRegister(false)}
        disabled={registering}
        className="w-full bg-rlc-red hover:bg-rlc-red/90"
      >
        {registering ? 'Registering...' : registrationFee ? `Register ($${registrationFee})` : 'Register Now'}
      </Button>
    );
  }

  if (guestMode) {
    return (
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Full Name"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <input
          type="email"
          placeholder="Email Address"
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <Button
          onClick={() => handleRegister(true)}
          disabled={registering}
          className="w-full bg-rlc-red hover:bg-rlc-red/90"
        >
          {registering ? 'Registering...' : 'Register as Guest'}
        </Button>
        <button
          onClick={() => setGuestMode(false)}
          className="w-full text-sm text-muted-foreground hover:underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={() => router.push(`/sign-in?redirect_url=/events/${eventSlug}`)}
        className="w-full bg-rlc-red hover:bg-rlc-red/90"
      >
        Sign In to Register
      </Button>
      <button
        onClick={() => setGuestMode(true)}
        className="w-full text-sm text-muted-foreground hover:underline"
      >
        Register as Guest
      </button>
    </div>
  );
}
