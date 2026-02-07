import { Metadata } from 'next';
import Link from 'next/link';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { ShieldX } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Unauthorized - RLC',
  description: 'You do not have permission to access this page.',
};

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <main className="flex flex-1 items-center justify-center py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
            <ShieldX className="h-12 w-12 text-red-600" />
          </div>

          <h1 className="mb-4 text-4xl font-bold">Access Denied</h1>

          <p className="mb-8 text-lg text-muted-foreground">
            You do not have permission to access this page. If you believe this is an error,
            please contact an administrator.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Return Home</Link>
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
