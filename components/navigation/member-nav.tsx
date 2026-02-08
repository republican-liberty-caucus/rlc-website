'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import {
  LayoutDashboard,
  User,
  CreditCard,
  Calendar,
  Menu,
  X,
  Shield,
  Users,
  Megaphone,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const engagementItems = [
  { href: '/action-center', label: 'Action Center', icon: Megaphone },
  { href: '/scorecards', label: 'Scorecards', icon: Target },
];

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/membership', label: 'Membership', icon: Shield },
  { href: '/household', label: 'Household', icon: Users },
  { href: '/contributions', label: 'Contributions', icon: CreditCard },
  { href: '/my-events', label: 'My Events', icon: Calendar },
];

export function MemberNav() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <Image
            src="/images/rlc-logo-100.png"
            alt="RLC"
            width={100}
            height={30}
            className="h-8 w-auto"
          />
          <span className="hidden text-sm font-medium text-muted-foreground sm:inline-block">
            Member Portal
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center md:flex">
          {/* Engagement links */}
          <div className="flex items-center space-x-1">
            {engagementItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-rlc-red/10 text-rlc-red'
                      : 'text-rlc-red/70 hover:bg-rlc-red/5 hover:text-rlc-red'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="mx-2 h-5 w-px bg-border" />
          {/* Standard nav links */}
          <div className="flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
            <Link href="/">Back to Site</Link>
          </Button>
          <UserButton afterSignOutUrl="/" />

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="border-t md:hidden">
          <nav className="container mx-auto flex flex-col space-y-1 px-4 py-4">
            {/* Engagement section */}
            <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Take Action
            </p>
            {engagementItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-rlc-red/10 text-rlc-red'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <div className="my-2 h-px bg-border" />
            <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              My Account
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <div className="pt-2">
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/">Back to Site</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
