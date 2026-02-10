import Link from 'next/link';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <main className="flex flex-1 items-center justify-center py-16">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-rlc-red">404</h1>
          <h2 className="mt-4 text-2xl font-semibold">Page Not Found</h2>
          <p className="mt-2 text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button asChild>
              <Link href="/">Back to Home</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/blog">Read the Blog</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
