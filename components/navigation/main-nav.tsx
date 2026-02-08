'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import {
  BookOpen,
  ChevronDown,
  History,
  Menu,
  Mic,
  ScrollText,
  Users,
  Vote,
  Scale,
  UserCheck,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NavChild {
  href: string;
  label: string;
  description: string;
  icon: React.ElementType;
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
      { href: '/about', label: 'About Us', description: 'Our mission and leadership', icon: Users },
      { href: '/about/principles', label: 'Statement of Principles', description: 'Core platform and positions', icon: BookOpen },
      { href: '/about/history', label: 'History', description: 'Our story since 1991', icon: History },
      { href: '/about/bylaws', label: 'Bylaws & Rules', description: 'Governing documents', icon: ScrollText },
      { href: '/about/committees', label: 'Committees', description: 'Committee structure', icon: Users },
      { href: '/about/speakers', label: 'Speakers Bureau', description: 'Book an RLC speaker', icon: Mic },
    ],
  },
  {
    href: '/endorsements',
    label: 'Endorsements',
    children: [
      { href: '/endorsements', label: 'Endorsements', description: 'Candidates we support', icon: Vote },
      { href: '/endorsements/process', label: 'Endorsement Process', description: 'How candidates earn support', icon: Scale },
      { href: '/endorsements/elected-officials', label: 'Elected Officials', description: 'RLC-endorsed officeholders', icon: UserCheck },
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

function NavDropdown({
  item,
  isActive,
  pathname,
}: {
  item: NavItem;
  isActive: (href: string) => boolean;
  pathname: string;
}) {
  const [open, setOpen] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  function handleEnter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }

  function handleLeave() {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }

  // Close on route change
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none',
          isActive(item.href)
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {item.label}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
        {/* Active indicator bar */}
        {isActive(item.href) && (
          <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-rlc-red" />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className={cn(
            'absolute left-0 top-full z-50 pt-2',
            // Wider panel for About (6 items), narrower for Endorsements (3)
            item.children && item.children.length > 4 ? 'w-[340px]' : 'w-[300px]'
          )}
        >
          <div className="overflow-hidden rounded-lg border bg-popover shadow-lg shadow-black/8">
            {/* Blue accent bar at top */}
            <div className="h-1 bg-gradient-to-r from-rlc-blue to-rlc-blue/70" />

            <div className="p-2">
              {item.children?.map((child) => {
                const Icon = child.icon;
                const active = pathname === child.href;

                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      'group flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors',
                      active
                        ? 'bg-rlc-red/8 text-foreground'
                        : 'text-foreground/80 hover:bg-muted'
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
                        active
                          ? 'bg-rlc-red/15 text-rlc-red'
                          : 'bg-muted text-muted-foreground group-hover:bg-rlc-red/10 group-hover:text-rlc-red'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div
                        className={cn(
                          'text-sm font-medium leading-tight',
                          active && 'text-rlc-red'
                        )}
                      >
                        {child.label}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground leading-snug">
                        {child.description}
                      </div>
                    </div>
                    {/* Active dot */}
                    {active && (
                      <div className="ml-auto mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rlc-red" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
                <NavDropdown
                  key={item.href}
                  item={item}
                  isActive={isActive}
                  pathname={pathname}
                />
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {item.label}
                  {isActive(item.href) && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-rlc-red" />
                  )}
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
                  'relative rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label}
                {isActive(item.href) && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-rlc-red" />
                )}
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
          <nav className="container mx-auto flex flex-col px-4 py-3">
            {[...primaryNavItems, ...secondaryNavItems].map((item) =>
              item.children ? (
                <div key={item.href} className="border-b border-border/50 last:border-0">
                  <button
                    onClick={() => toggleMobileExpanded(item.href)}
                    className={cn(
                      'flex w-full items-center justify-between py-3 text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {isActive(item.href) && (
                        <span className="h-4 w-0.5 rounded-full bg-rlc-red" />
                      )}
                      {item.label}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform duration-200',
                        mobileExpanded === item.href && 'rotate-180'
                      )}
                    />
                  </button>

                  {/* Expandable children */}
                  <div
                    className={cn(
                      'overflow-hidden transition-all duration-200',
                      mobileExpanded === item.href
                        ? 'max-h-[500px] opacity-100 pb-2'
                        : 'max-h-0 opacity-0'
                    )}
                  >
                    <div className="ml-1 space-y-0.5 border-l-2 border-rlc-blue/20 pl-4">
                      {item.children.map((child) => {
                        const Icon = child.icon;
                        const active = pathname === child.href;

                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              'flex items-center gap-3 rounded-md px-2 py-2 transition-colors',
                              active
                                ? 'bg-rlc-red/8 text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <Icon
                              className={cn(
                                'h-4 w-4 shrink-0',
                                active ? 'text-rlc-red' : 'text-muted-foreground/60'
                              )}
                            />
                            <div>
                              <span
                                className={cn(
                                  'text-sm font-medium',
                                  active && 'text-rlc-red'
                                )}
                              >
                                {child.label}
                              </span>
                              <p className="text-xs text-muted-foreground/70 leading-snug">
                                {child.description}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 border-b border-border/50 py-3 text-sm font-medium transition-colors last:border-0',
                    isActive(item.href)
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {isActive(item.href) && (
                    <span className="h-4 w-0.5 rounded-full bg-rlc-red" />
                  )}
                  {item.label}
                </Link>
              )
            )}
            <div className="flex flex-col space-y-2 border-t pt-4 mt-1">
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
