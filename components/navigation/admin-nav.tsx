'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import {
  LayoutDashboard,
  Users,
  MapPin,
  Calendar,
  FileText,
  Settings,
  CreditCard,
  BarChart,
  ClipboardList,
  Target,
  Megaphone,
  Split,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavSection {
  label: string;
  items: Array<{
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}

const navSections: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/admin/members', label: 'Members', icon: Users },
      { href: '/admin/chapters', label: 'Chapters', icon: MapPin },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/posts', label: 'Posts', icon: FileText },
      { href: '/admin/events', label: 'Events', icon: Calendar },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { href: '/admin/scorecards', label: 'Scorecards', icon: Target },
      { href: '/admin/campaigns', label: 'Campaigns', icon: Megaphone },
      { href: '/admin/surveys', label: 'Surveys', icon: ClipboardList },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/admin/contributions', label: 'Contributions', icon: CreditCard },
      { href: '/admin/dues-sharing', label: 'Dues Sharing', icon: Split },
      { href: '/admin/reports', label: 'Reports', icon: BarChart },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/admin" className="flex items-center space-x-2">
          <Image
            src="/images/rlc-logo-100.png"
            alt="RLC"
            width={100}
            height={30}
            className="h-7 w-auto"
          />
          <span className="text-sm font-medium text-muted-foreground">Admin</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        {navSections.map((section, sectionIdx) => (
          <div key={section.label}>
            {sectionIdx > 0 && <div className="my-3 h-px bg-border" />}
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/admin' && pathname.startsWith(item.href));

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-rlc-red/10 text-rlc-red'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to Site
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </aside>
  );
}
