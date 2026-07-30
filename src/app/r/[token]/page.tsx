import { notFound } from 'next/navigation';
import { getExplanation, getReport, getRows, getShareLinkByToken } from '@/lib/data';
import { isDobConfirmed } from '@/lib/auth/dob-gate';
import { isExpired } from '@/lib/share-link';
import { buildResultsView } from '@/lib/ui/results-view';
import { patientGate } from '@/lib/ui/patient-gate';
import { DobGate } from '@/components/patient/dob-gate';
import { ResultsPage } from '@/components/patient/results-page';
import { PatientNotice } from '@/components/patient/patient-notice';

function ExpiredNotice() {
  return (
    <PatientNotice tone="calm" heading="This link has expired">
      For your privacy, result links expire after a while. The clinic can send you a fresh one.
    </PatientNotice>
  );
}

export default async function PatientShare({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const link = await getShareLinkByToken(token);
  if (link === null) notFound();
  if (isExpired(link.expiresAt)) return <ExpiredNotice />;

  if (!(await isDobConfirmed(token))) {
    return <DobGate token={token} expiresAt={link.expiresAt} />;
  }

  const report = await getReport(link.reportId);
  const explanation = await getExplanation(link.reportId);
  const rows = await getRows(link.reportId);

  // The render gate (pure, exhaustively tested in patient-gate.test.ts): only an
  // approved explanation on an approved/sent report renders, and a report with a
  // critical row never renders even if its statuses say approved (FR-07/FR-10).
  // Blocked is a content-neutral notFound — it reveals nothing. The null checks
  // narrow the types here; patientGate re-checks them as part of its contract.
  if (report === null || explanation === null) notFound();
  if (patientGate({ report, explanation, rows }) === 'blocked') {
    notFound();
  }

  const view = buildResultsView(rows, explanation);
  return <ResultsPage report={report} explanation={explanation} view={view} token={token} />;
}
