'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AdminNav } from '@/components/navigation/admin-nav';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close sheet on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <div className="hidden md:block print:hidden">
        <AdminNav />
      </div>

      {/* Mobile header + content */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-card px-4 md:hidden print:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0" aria-describedby={undefined}>
              <SheetTitle className="sr-only">Navigation menu</SheetTitle>
              <AdminNav onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link href="/admin" className="flex items-center gap-2">
            <Image
              src="/images/rlc-logo-100.png"
              alt="RLC"
              width={100}
              height={30}
              className="h-6 w-auto"
            />
            <span className="text-sm font-medium text-muted-foreground">Admin</span>
          </Link>
        </header>

        <main className="flex-1 bg-muted/30 print:bg-white">
          <div className="p-4 md:p-8 print:p-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
