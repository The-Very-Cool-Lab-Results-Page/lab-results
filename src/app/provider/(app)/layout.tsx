import type { ReactNode } from 'react';
import { requireProvider } from '@/lib/auth/session';
import { listReports } from '@/lib/data';
import type { ReportStatus } from '@/lib/types';
import { ProviderShell, type ReportCounts } from '@/components/provider/provider-shell';

const IN_PROGRESS_STATUSES: ReportStatus[] = ['uploaded', 'extracted', 'drafted', 'approved'];

/** Gates every authenticated provider page and provides the workspace shell. */
export default async function ProviderAppLayout({ children }: { children: ReactNode }) {
  await requireProvider();

  const reports = await listReports();
  const counts: ReportCounts = {
    all: reports.length,
    inProgress: reports.filter((report) => IN_PROGRESS_STATUSES.includes(report.status)).length,
    held: reports.filter((report) => report.status === 'held').length,
    sent: reports.filter((report) => report.status === 'sent').length,
  };

  return <ProviderShell counts={counts}>{children}</ProviderShell>;
}
