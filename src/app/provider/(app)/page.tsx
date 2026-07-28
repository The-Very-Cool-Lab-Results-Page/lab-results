import Link from 'next/link';
import { listReports } from '@/lib/data';
import type { ReportStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ReportsBrowser } from '@/components/provider/reports-browser';

const IN_PROGRESS_STATUSES: ReportStatus[] = ['uploaded', 'extracted', 'drafted', 'approved'];

export default async function ProviderDashboard() {
  const reports = await listReports();
  const counts = {
    total: reports.length,
    inProgress: reports.filter((report) => IN_PROGRESS_STATUSES.includes(report.status)).length,
    held: reports.filter((report) => report.status === 'held').length,
    sent: reports.filter((report) => report.status === 'sent').length,
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Reports</h1>
          <p className="mt-1 max-w-prose text-sm text-muted">
            Open a report to verify what was read and approve the explanation before it reaches the
            patient. A critical result is held for you to contact the patient directly.
          </p>
        </div>
        <Link href="/provider/upload">
          <Button>New report</Button>
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No reports yet"
            description="Start a report to walk the flow. Everything here runs on synthetic data."
            action={
              <Link href="/provider/upload">
                <Button>New report</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="All reports" value={counts.total} icon={ICONS.all} />
            <StatTile label="In progress" value={counts.inProgress} icon={ICONS.progress} />
            <StatTile label="Held" value={counts.held} tone="critical" icon={ICONS.held} />
            <StatTile label="Sent" value={counts.sent} tone="forest" icon={ICONS.sent} />
          </div>
          <ReportsBrowser reports={reports} />
        </>
      )}
    </div>
  );
}

const ICONS = {
  all: <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />,
  progress: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  held: (
    <>
      <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
      <path
        d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
        strokeLinejoin="round"
      />
    </>
  ),
  sent: <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />,
} as const;

function StatTile({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone?: 'critical' | 'forest';
  icon: React.ReactNode;
}) {
  const accent =
    tone === 'critical' ? 'text-critical' : tone === 'forest' ? 'text-forest' : 'text-ink';
  const iconWrap =
    tone === 'critical'
      ? 'bg-critical-soft text-critical'
      : tone === 'forest'
        ? 'bg-forest-soft text-forest'
        : 'bg-line/60 text-muted';
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-paper px-5 py-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-full ${iconWrap}`}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden
            className="h-4 w-4"
          >
            {icon}
          </svg>
        </span>
      </div>
      <p className={`mt-2 font-display text-3xl ${accent}`}>{value}</p>
    </div>
  );
}
