'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const primaryNavItems = [
  { href: '/about', label: 'About' },
  { href: '/chapters', label: 'Chapters' },
  { href: '/scorecards', label: 'Scorecards' },
  { href: '/action-center', label: 'Action Center' },
];

const secondaryNavItems = [
  { href: '/blog', label: 'Blog' },
  { href: '/events', label: 'Events' },
];

export function MainNav() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <Image
            src="/images/rlc-logo-200.png"
            alt="Republican Liberty Caucus"
            width={140}
            height={40}
            className="h-9 w-auto"
            priority
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center md:flex">
          <div className="flex items-center space-x-1">
            {primaryNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mx-3 h-5 w-px bg-border" />
          <div className="flex items-center space-x-1">
            {secondaryNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Auth + CTA Buttons */}
        <div className="hidden items-center space-x-3 md:flex">
          <SignedOut>
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/donate">Donate</Link>
            </Button>
            <Button asChild size="sm" className="bg-rlc-red text-white hover:bg-rlc-red/90 font-semibold">
              <Link href="/join">Join the RLC</Link>
            </Button>
          </SignedOut>
          <SignedIn>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="border-t md:hidden">
          <nav className="container mx-auto flex flex-col space-y-1 px-4 py-4">
            {[...primaryNavItems, ...secondaryNavItems].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="flex flex-col space-y-2 pt-4">
              <SignedOut>
                <Button asChild variant="outline" size="sm">
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/donate">Donate</Link>
                </Button>
                <Button asChild size="sm" className="bg-rlc-red text-white hover:bg-rlc-red/90 font-semibold">
                  <Link href="/join">Join the RLC</Link>
                </Button>
              </SignedOut>
              <SignedIn>
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              </SignedIn>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
