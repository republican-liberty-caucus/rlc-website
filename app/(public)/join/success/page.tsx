import { Metadata } from 'next';
import Link from 'next/link';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Welcome to the RLC!',
  description: 'Your membership has been activated.',
};

export default function JoinSuccessPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <section className="flex flex-1 items-center justify-center py-16">
        <div className="container mx-auto max-w-lg px-4 text-center">
          <div className="mb-6 flex justify-center">
            <CheckCircle className="h-20 w-20 text-green-500" />
          </div>

          <h1 className="mb-4 text-3xl font-bold">Welcome to the RLC!</h1>

          <p className="mb-2 text-lg text-muted-foreground">
            Your payment was successful and your membership is now active.
          </p>

          <p className="mb-8 text-muted-foreground">
            You&apos;ll receive a confirmation email shortly with your membership details.
            Sign in to access your member dashboard.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild className="bg-rlc-red hover:bg-rlc-red/90">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Return Home</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
