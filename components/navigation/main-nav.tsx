'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { ChevronDown, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavChild {
  href: string;
  label: string;
}

interface NavItem {
  href: string;
  label: string;
  children?: NavChild[];
}

const primaryNavItems: NavItem[] = [
  {
    href: '/about',
    label: 'About',
    children: [
      { href: '/about', label: 'About Us' },
      { href: '/about/principles', label: 'Statement of Principles' },
      { href: '/about/history', label: 'History' },
      { href: '/about/bylaws', label: 'Bylaws & Rules' },
      { href: '/about/committees', label: 'Committees' },
      { href: '/about/speakers', label: 'Speakers Bureau' },
    ],
  },
  {
    href: '/endorsements',
    label: 'Endorsements',
    children: [
      { href: '/endorsements', label: 'Endorsements' },
      { href: '/endorsements/process', label: 'Endorsement Process' },
      { href: '/endorsements/elected-officials', label: 'Elected Officials' },
    ],
  },
  { href: '/chapters', label: 'Chapters' },
  { href: '/scorecards', label: 'Scorecards' },
  { href: '/action-center', label: 'Action Center' },
];

const secondaryNavItems: NavItem[] = [
  { href: '/blog', label: 'Blog' },
  { href: '/events', label: 'Events' },
];

export function MainNav() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [mobileExpanded, setMobileExpanded] = React.useState<string | null>(null);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  function toggleMobileExpanded(href: string) {
    setMobileExpanded((prev) => (prev === href ? null : href));
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
            {primaryNavItems.map((item) =>
              item.children ? (
                <DropdownMenu key={item.href}>
                  <DropdownMenuTrigger
                    className={cn(
                      'flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none',
                      isActive(item.href)
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                  >
                    {item.label}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={8}>
                    {item.children.map((child) => (
                      <DropdownMenuItem key={child.href} asChild>
                        <Link
                          href={child.href}
                          className={cn(
                            'w-full cursor-pointer',
                            pathname === child.href && 'bg-accent'
                          )}
                        >
                          {child.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
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
              )
            )}
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
            {[...primaryNavItems, ...secondaryNavItems].map((item) =>
              item.children ? (
                <div key={item.href}>
                  <button
                    onClick={() => toggleMobileExpanded(item.href)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {item.label}
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform',
                        mobileExpanded === item.href && 'rotate-180'
                      )}
                    />
                  </button>
                  {mobileExpanded === item.href && (
                    <div className="ml-4 flex flex-col space-y-1 border-l pl-3 pt-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            'rounded-md px-3 py-1.5 text-sm transition-colors',
                            pathname === child.href
                              ? 'font-medium text-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
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
              )
            )}
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
