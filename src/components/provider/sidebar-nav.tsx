'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';

/**
 * Provider workspace navigation with active-state highlighting. Client-only for
 * usePathname; the rest of the shell (brand, account) stays in the server layout.
 * A report detail path (/provider/reports/[id]) still highlights Reports.
 */
interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  match: (pathname: string) => boolean;
}

const ITEMS: NavItem[] = [
  {
    href: '/provider',
    label: 'Reports',
    match: (p) => p === '/provider' || p.startsWith('/provider/reports'),
    icon: (
      <>
        <path
          d="M8 4h9a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M8 4v16H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2Z" strokeLinejoin="round" />
        <path d="M11 9h5M11 13h5" strokeLinecap="round" />
      </>
    ),
  },
  {
    href: '/provider/upload',
    label: 'New report',
    match: (p) => p.startsWith('/provider/upload'),
    icon: <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />,
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Provider workspace">
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-forest-soft text-forest' : 'text-muted hover:bg-line/40 hover:text-ink',
            )}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden
              className="h-5 w-5 shrink-0"
            >
              {item.icon}
            </svg>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
