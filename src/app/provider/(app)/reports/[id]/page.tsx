import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getExplanation, getOutreach, getReport, getRows, getShareLinkByReport } from '@/lib/data';
import { analyteDisplayName } from '@/lib/data/dictionary';
import {
  PROVIDER_STEPS,
  reportStatusDisplay,
  stepIndexForStatus,
} from '@/lib/ui/report-status-display';
import {
  extractReportAction,
  resetReportAction,
  retryDraftAction,
  sendLinkAction,
} from '@/app/provider/actions';
import { classificationDisplay } from '@/lib/ui/classification-display';
import { criticalAnalyteIds, outstandingOutreach } from '@/lib/ui/outreach';
import { CLINIC } from '@/lib/clinic';
import { isExpired } from '@/lib/share-link';
import { Stepper } from '@/components/ui/stepper';
import { StatusPill } from '@/components/ui/status-pill';
import { SubmitButton } from '@/components/ui/submit-button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { VerifyTable } from '@/components/provider/verify-table';
import { DraftEditor, type DraftEntry } from '@/components/provider/draft-editor';
import {
  CriticalOutreachPanel,
  type CriticalItem,
} from '@/components/provider/critical-outreach-panel';
import { CopyLinkButton } from '@/components/provider/copy-link-button';
import { PdfFileInput } from '@/components/provider/pdf-file-input';
import { PendingNote } from '@/components/provider/pending-note';
import { ScrollReset } from '@/components/provider/scroll-reset';

function formatExpiry(expiresAt: string): string {
  return new Date(expiresAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReport(id);
  if (report === null) notFound();

  const rows = await getRows(id);
  const explanation = await getExplanation(id);
  const shareLink = report.status === 'sent' ? await getShareLinkByReport(id) : null;
  const outreach = report.status === 'held' ? await getOutreach(id) : [];
  const status = reportStatusDisplay(report.status);
  const criticalRows = rows.filter(
    (row) => row.classification?.kind === 'range' && row.classification.critical,
  );
  const criticalItems: CriticalItem[] = criticalRows.map((row) => ({
    analyteId: row.analyteId,
    displayName: analyteDisplayName(row.analyteId, row.rawName),
    value: row.value,
    unit: row.unit,
    contacts: outreach.filter((entry) => entry.analyteId === row.analyteId),
  }));
  const outstandingCritical = outstandingOutreach(criticalAnalyteIds(rows), outreach);

  const rowByAnalyte = new Map(
    rows.filter((row) => row.analyteId).map((row) => [row.analyteId as string, row]),
  );
  const draftEntries: DraftEntry[] = (explanation?.perTest ?? []).map((entry) => {
    const row = rowByAnalyte.get(entry.analyteId);
    const display = classificationDisplay(
      row?.classification ?? { kind: 'unclassifiable', reason: 'no-range' },
    );
    return {
      analyteId: entry.analyteId,
      displayName: analyteDisplayName(entry.analyteId, entry.analyteId),
      text: entry.text,
      value: row?.value ?? '',
      unit: row?.unit,
      tone: display.tone,
      statusLabel: display.label,
    };
  });

  return (
    <div>
      <ScrollReset trigger={report.status} />
      <Link href="/provider" className="text-sm text-forest hover:underline">
        Back to reports
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">{report.patient.name}</h1>
          <p className="mt-1 text-sm text-muted">{report.patient.email}</p>
        </div>
        <StatusPill tone={status.tone} label={status.label} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Stepper steps={PROVIDER_STEPS} current={stepIndexForStatus(report.status)} />
        {report.status !== 'uploaded' && (
          <form action={resetReportAction}>
            <input type="hidden" name="reportId" value={report.id} />
            <ConfirmButton
              message="Start this report over? This clears its progress and any sent link."
              className="text-sm text-muted transition-colors hover:text-forest"
            >
              Start over
            </ConfirmButton>
          </form>
        )}
      </div>

      <div className="mt-10">
        {report.status === 'uploaded' && (
          <section>
            <h2 className="font-display text-xl text-ink">Read the report</h2>
            <p className="mt-1 max-w-prose text-sm text-muted">
              The system transcribes each test line. You verify every value before anything is
              classified.
            </p>
            <form action={extractReportAction} className="mt-6 max-w-xl">
              <input type="hidden" name="reportId" value={report.id} />
              <p className="mb-2 text-sm font-medium text-ink">
                Report PDF <span className="font-normal text-muted">(optional in v1)</span>
              </p>
              <PdfFileInput name="pdf" />
              <p className="mt-2 max-w-prose text-xs text-muted">
                With a PDF and an API key configured, the report is transcribed live. Otherwise a
                synthetic sample is used so the flow can be walked without credentials.
              </p>
              <div className="mt-4">
                <SubmitButton pendingLabel="Reading...">Read the results</SubmitButton>
              </div>
              <PendingNote>
                Transcribing the report line by line. With a PDF this is a live model call and takes
                a few seconds.
              </PendingNote>
            </form>
          </section>
        )}

        {report.status === 'extracted' && (
          <section>
            <h2 className="font-display text-xl text-ink">Verify the results</h2>
            <p className="mt-1 max-w-prose text-sm text-muted">
              Check each value against the report and correct anything that was misread. The preview
              shows where each value lands. A critical result will hold the report for a direct
              call.
            </p>
            <VerifyTable
              reportId={report.id}
              rows={rows.map((row) => ({
                id: row.id,
                rawName: row.rawName,
                analyteId: row.analyteId,
                value: row.value,
                unit: row.unit ?? '',
                refLow: row.refLow?.toString() ?? '',
                refHigh: row.refHigh?.toString() ?? '',
                rawRange: row.rawRange ?? '',
                labFlags: row.labFlags,
                lowConfidenceFields: row.lowConfidenceFields,
              }))}
            />
          </section>
        )}

        {report.status === 'verified' && (
          <section>
            <h2 className="font-display text-xl text-ink">Drafting didn&apos;t complete</h2>
            <p className="mt-1 max-w-prose text-sm text-muted">
              The results are verified and classified, but the plain-language draft could not be
              generated. Nothing is lost — try drafting again.
            </p>
            <form action={retryDraftAction} className="mt-4">
              <input type="hidden" name="reportId" value={report.id} />
              <SubmitButton pendingLabel="Drafting...">Draft the explanation</SubmitButton>
              <PendingNote>
                Drafting the explanation from MedlinePlus. This runs a live model call and takes a
                few seconds.
              </PendingNote>
            </form>
          </section>
        )}

        {report.status === 'held' && (
          <CriticalOutreachPanel
            reportId={report.id}
            items={criticalItems}
            outstandingCount={outstandingCritical.length}
          />
        )}

        {report.status === 'drafted' && explanation !== null && (
          <section>
            <h2 className="font-display text-xl text-ink">Review the explanation</h2>
            <p className="mt-1 max-w-prose text-sm text-muted">
              Drafted from the classifications and MedlinePlus. Edit any wording, then approve to
              make it what the patient reads.
            </p>
            <div className="mt-6">
              <DraftEditor
                reportId={report.id}
                overallText={explanation.overallText}
                entries={draftEntries}
              />
            </div>
          </section>
        )}

        {report.status === 'approved' && explanation !== null && (
          <section>
            <h2 className="font-display text-xl text-ink">Approved explanation</h2>
            <p className="mt-1 max-w-prose text-sm text-muted">
              This is the frozen text the patient reads. To change it, start the report over.
            </p>
            <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-paper p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Overall picture
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink/90">{explanation.overallText}</p>
              <div className="mt-4 flex flex-col gap-3">
                {explanation.perTest.map((entry) => (
                  <div key={entry.analyteId}>
                    <p className="text-sm font-medium text-ink">
                      {analyteDisplayName(entry.analyteId, entry.analyteId)}
                    </p>
                    <p className="text-sm text-muted">{entry.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-[var(--radius-card)] border border-forest/20 bg-forest-soft/40 p-5">
              <h3 className="font-medium text-ink">Ready to send</h3>
              <p className="mt-1 text-sm text-muted">
                Send the patient their private, date-of-birth protected link.
              </p>
              <form action={sendLinkAction} className="mt-4">
                <input type="hidden" name="reportId" value={report.id} />
                <SubmitButton pendingLabel="Sending...">Send to patient</SubmitButton>
              </form>
            </div>
          </section>
        )}

        {report.status === 'sent' && shareLink !== null && (
          <section className="rounded-[var(--radius-card)] border border-forest/20 bg-forest-soft/40 p-6">
            <h2 className="font-display text-xl text-ink">Sent to the patient</h2>
            <p className="mt-1 text-sm text-muted">
              The patient link opens after they confirm their date of birth ({CLINIC.providerName}
              &apos;s patients enter their DOB). Copy it to share directly.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href={`/r/${shareLink.token}`}
                className="break-all font-mono text-sm text-forest underline underline-offset-2"
              >
                /r/{shareLink.token}
              </Link>
              <CopyLinkButton path={`/r/${shareLink.token}`} />
            </div>
            <div className="mt-5 border-t border-forest/15 pt-4">
              <p className="text-sm text-muted">
                {isExpired(shareLink.expiresAt)
                  ? `This link expired on ${formatExpiry(shareLink.expiresAt)}. Re-sending emails the patient a fresh link.`
                  : `The link works until ${formatExpiry(shareLink.expiresAt)}. Re-sending re-emails this same link, for when the patient lost the first email.`}
              </p>
              <form action={sendLinkAction} className="mt-3">
                <input type="hidden" name="reportId" value={report.id} />
                <SubmitButton variant="secondary" pendingLabel="Re-sending...">
                  Re-send the link
                </SubmitButton>
              </form>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
