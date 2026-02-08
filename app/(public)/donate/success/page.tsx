import { Metadata } from 'next';
import Link from 'next/link';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Thank You for Your Donation',
  description: 'Your donation to the Republican Liberty Caucus has been received.',
};

export default function DonateSuccessPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <section className="flex flex-1 items-center justify-center py-16">
        <div className="container mx-auto px-4 text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-600" />
          <h1 className="mt-6 text-3xl font-bold">Thank You for Your Generosity!</h1>
          <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
            Your donation has been processed successfully. Your support helps advance
            the principles of individual rights, limited government, and free markets
            within the Republican Party.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            A confirmation email has been sent to your email address.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild className="bg-rlc-red hover:bg-rlc-red/90">
              <Link href="/">Return Home</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/join">Become a Member</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
