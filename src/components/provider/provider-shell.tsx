'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { APP_NAME, CLINIC } from '@/lib/clinic';
import { signOutAction } from '@/app/provider/actions';
import { cn } from '@/lib/ui/cn';

export interface ReportCounts {
  all: number;
  inProgress: number;
  held: number;
  sent: number;
}

/**
 * The provider workspace shell: a filter rail (the sidebar's real job now that
 * stat tiles and filter chips are merged into it) plus brand, a New report CTA,
 * and the account block. On mobile it collapses behind a hamburger drawer. The
 * filters drive the reports list through the `status` query param, so they double
 * as navigation from anywhere in the workspace.
 */
interface FilterDef {
  key: string;
  label: string;
  count: (c: ReportCounts) => number;
  tone?: 'critical';
  icon: ReactNode;
}

const FILTERS: FilterDef[] = [
  {
    key: 'all',
    label: 'All reports',
    count: (c) => c.all,
    icon: <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />,
  },
  {
    key: 'in-progress',
    label: 'In progress',
    count: (c) => c.inProgress,
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    key: 'held',
    label: 'Held',
    count: (c) => c.held,
    tone: 'critical',
    icon: (
      <>
        <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        <path
          d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  {
    key: 'sent',
    label: 'Sent',
    count: (c) => c.sent,
    icon: <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />,
  },
];

function hrefFor(key: string): string {
  return key === 'all' ? '/provider' : `/provider?status=${key}`;
}

export function ProviderShell({ counts, children }: { counts: ReportCounts; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onReports = pathname === '/provider';
  const activeKey = onReports ? (searchParams.get('status') ?? 'all') : null;

  const rail = (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-5 py-5">
        <Link href="/provider" onClick={() => setOpen(false)} className="block">
          <span className="font-display text-lg leading-tight text-ink">{APP_NAME}</span>
          <span className="mt-0.5 block text-xs text-muted">Provider workspace</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <Link
          href="/provider/upload"
          onClick={() => setOpen(false)}
          className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-forest px-3 py-2 text-sm font-medium text-cream transition-colors hover:bg-forest/90"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
            className="h-4 w-4"
          >
            <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          New report
        </Link>

        <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Reports
        </p>
        <nav className="flex flex-col gap-0.5" aria-label="Filter reports">
          {FILTERS.map((filter) => {
            const active = activeKey === filter.key;
            const count = filter.count(counts);
            return (
              <Link
                key={filter.key}
                href={hrefFor(filter.key)}
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-forest-soft font-medium text-forest'
                    : 'text-muted hover:bg-line/40 hover:text-ink',
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
                  {filter.icon}
                </svg>
                <span className="flex-1">{filter.label}</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                    filter.tone === 'critical' && count > 0
                      ? 'bg-critical-soft text-critical'
                      : 'bg-line/60 text-muted',
                  )}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-soft text-xs font-semibold text-forest">
            DA
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">
              {CLINIC.providerName}
            </span>
            <span className="block truncate text-xs text-muted">{CLINIC.name}</span>
          </span>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-line/40 hover:text-ink"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-cream">
      <a
        href="#provider-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded focus:bg-forest focus:px-4 focus:py-2 focus:text-cream"
      >
        Skip to content
      </a>

      {/* Desktop rail */}
      <aside className="hidden w-64 shrink-0 border-r border-line bg-paper md:sticky md:top-0 md:block md:h-screen">
        {rail}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-ink/30 md:hidden"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 max-w-[80%] border-r border-line bg-paper transition-transform duration-200 md:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {rail}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-paper px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-1.5 text-ink transition-colors hover:bg-line/40"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
              className="h-6 w-6"
            >
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <Link href="/provider" className="font-display text-lg text-ink">
            {APP_NAME}
          </Link>
        </header>

        <main id="provider-main" className="flex-1">
          <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:px-10 md:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
