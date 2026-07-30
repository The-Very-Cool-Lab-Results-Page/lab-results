import Link from 'next/link';
import { listReports } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ReportsBrowser, type ReportFilter } from '@/components/provider/reports-browser';

const FILTERS: ReportFilter[] = ['all', 'in-progress', 'held', 'sent'];

const HEADING: Record<ReportFilter, string> = {
  all: 'Reports',
  'in-progress': 'In progress',
  held: 'Held for a direct call',
  sent: 'Sent to patients',
};

function normalizeFilter(status: string | undefined): ReportFilter {
  return FILTERS.includes(status as ReportFilter) ? (status as ReportFilter) : 'all';
}

export default async function ProviderDashboard({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const reports = await listReports();
  const filter = normalizeFilter((await searchParams).status);

  return (
    <div>
      <div>
        <h1 className="font-display text-3xl text-ink">{HEADING[filter]}</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Open a report to verify what was read and approve the explanation before it reaches the
          patient. A critical result is held for you to contact the patient directly.
        </p>
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
        <ReportsBrowser reports={reports} filter={filter} />
      )}
    </div>
  );
}
