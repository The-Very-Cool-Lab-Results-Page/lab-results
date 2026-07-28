'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Report } from '@/lib/types';
import { reportAction, reportStatusDisplay } from '@/lib/ui/report-status-display';
import { cn } from '@/lib/ui/cn';
import { StatusPill } from '@/components/ui/status-pill';
import { EmptyState } from '@/components/ui/empty-state';

type Filter = 'all' | 'in-progress' | 'held' | 'sent';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'held', label: 'Held' },
  { key: 'sent', label: 'Sent' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function matchesFilter(report: Report, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'held') return report.status === 'held';
  if (filter === 'sent') return report.status === 'sent';
  return report.status !== 'held' && report.status !== 'sent';
}

export function ReportsBrowser({ reports }: { reports: Report[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = reports.filter((report) => {
      if (!matchesFilter(report, filter)) return false;
      if (q === '') return true;
      return (
        report.patient.name.toLowerCase().includes(q) ||
        report.patient.email.toLowerCase().includes(q)
      );
    });
    // Worklist order: reports needing action rise to the top, most urgent first
    // (held critical, then draft to review, then mid-pipeline, then send), and
    // done/sent reports sink. Ties break on most-recent so the list stays stable.
    return filtered.sort((a, b) => {
      const ua = reportAction(a.status)?.urgency ?? Number.POSITIVE_INFINITY;
      const ub = reportAction(b.status)?.urgency ?? Number.POSITIVE_INFINITY;
      if (ua !== ub) return ua - ub;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [reports, query, filter]);

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm transition-colors',
                filter === key
                  ? 'bg-forest text-cream'
                  : 'border border-line bg-paper text-muted hover:text-forest',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search patients"
          aria-label="Search patients"
          className="w-full rounded-full border border-line bg-paper px-4 py-2 text-sm text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20 sm:w-64"
        />
      </div>

      {visible.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No matching reports"
            description="Try a different search or filter, or start a new report."
          />
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {visible.map((report) => {
            const status = reportStatusDisplay(report.status);
            const action = reportAction(report.status);
            const critical = report.status === 'held';
            return (
              <li key={report.id}>
                <Link
                  href={`/provider/reports/${report.id}`}
                  className={cn(
                    'flex items-center justify-between gap-4 rounded-[var(--radius-card)] border bg-paper py-4 pr-5 pl-5 transition-colors hover:border-forest/40',
                    critical ? 'border-l-4 border-l-critical border-line pl-4' : 'border-line',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{report.patient.name}</p>
                    <p className="truncate text-sm text-muted">{report.patient.email}</p>
                    <p className="mt-1 text-xs text-muted">
                      Started {formatDate(report.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
                    <StatusPill tone={status.tone} label={status.label} />
                    {action && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-xs font-medium',
                          critical ? 'text-critical' : 'text-forest',
                        )}
                      >
                        {action.verb}
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden
                          className="h-3.5 w-3.5"
                        >
                          <path
                            d="M5 12h14m-6-6 6 6-6 6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
