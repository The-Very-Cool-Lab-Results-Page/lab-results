'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  addOutreach,
  approveExplanation,
  createReport,
  createShareLink,
  getExplanation,
  getReport,
  getRows,
  reportHasCritical,
  resetReport,
  saveExplanation,
  saveRows,
  setReportStatus,
} from '@/lib/data';
import { dobSchema, type Explanation, type OutreachMethod, type ResultRow } from '@/lib/types';
import { draftExplanation } from '@/lib/draft';
import { sendShareLink } from '@/lib/email';
import { extractRows } from '@/lib/extract';
import { matchAnalyte } from '@/lib/analytes';
import { classifyRow } from '@/lib/classify';
import { criticalAnalyteIds, OUTREACH_NOTE_MAX } from '@/lib/ui/outreach';
import type { EditableRow } from '@/components/provider/verify-table';
import {
  createProviderSession,
  destroyProviderSession,
  verifyProviderCredentials,
} from '@/lib/auth/session';

export interface FormState {
  error?: string;
}

function reportPath(reportId: string): string {
  return `/provider/reports/${reportId}`;
}

export async function uploadReportAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const dob = dobSchema.safeParse(String(formData.get('dob') ?? '').trim());
  if (name.length === 0 || !email.includes('@') || !dob.success) {
    return { error: 'Enter the patient name, a valid email, and a real date of birth.' };
  }
  // The PDF upload itself arrives with Supabase Storage; the report starts here.
  const report = await createReport({ name, email, dob: dob.data }, 'manual-entry');
  redirect(reportPath(report.id));
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  if (!verifyProviderCredentials(email, password)) {
    return { error: 'Those credentials did not match the demo provider account.' };
  }
  await createProviderSession();
  redirect('/provider');
}

export async function signOutAction(): Promise<void> {
  await destroyProviderSession();
  redirect('/provider/sign-in');
}

export async function extractReportAction(formData: FormData): Promise<void> {
  const reportId = String(formData.get('reportId') ?? '');
  const report = await getReport(reportId);
  if (report === null) return;

  // The provider may attach the report PDF on this step; its bytes feed the live
  // extractor in the same request (no persistence needed). With no file — or no
  // API key — extraction falls back to the offline synthetic path keyed by the
  // report's pdfRef, so the flow runs end to end without credentials.
  // The report may be a PDF or a photo of the printout (image/*); pass its real
  // media type so the model reads it as what it is. An empty type falls back to PDF.
  const file = formData.get('pdf');
  const hasBytes = file instanceof File && file.size > 0;
  const pdfBytes = hasBytes ? new Uint8Array(await file.arrayBuffer()) : undefined;
  const mediaType = hasBytes && file.type !== '' ? file.type : undefined;

  const { rows } = await extractRows({ pdfRef: report.pdfRef, pdfBytes, mediaType });

  // Transcription only (FR-03): store rows unmatched and unclassified. The
  // analyte match and classification are stamped after the provider verifies the
  // values against the report (FR-05/FR-06), in confirmVerificationAction.
  const stored: ResultRow[] = rows.map((row, index) => ({
    id: `${reportId}-${index}`,
    reportId,
    rawName: row.rawName,
    analyteId: undefined,
    value: row.value,
    unit: row.unit,
    refLow: toNumber(row.refLow ?? ''),
    refHigh: toNumber(row.refHigh ?? ''),
    rawRange: row.rawRange,
    labFlags: row.labFlags,
    lowConfidenceFields: row.lowConfidenceFields,
    classification: undefined,
  }));

  await saveRows(reportId, stored);
  await setReportStatus(reportId, 'extracted');
  revalidatePath(reportPath(reportId));
}

function toNumber(text: string): number | undefined {
  const value = Number(text.replace(/,/g, ''));
  return text.trim() === '' || !Number.isFinite(value) ? undefined : value;
}

export async function confirmVerificationAction(formData: FormData): Promise<void> {
  const reportId = String(formData.get('reportId') ?? '');

  let edited: EditableRow[] = [];
  try {
    edited = JSON.parse(String(formData.get('rows') ?? '[]')) as EditableRow[];
  } catch {
    edited = [];
  }

  // Persist the provider's corrections, stamped with the authoritative
  // classification (FR-06): the deterministic classifier runs on the verified
  // values, reading the curated dictionary for critical/plausibility thresholds.
  const rows: ResultRow[] = edited
    .filter((row) => row.rawName.trim() !== '')
    .map((row) => {
      // Normalization runs on the verified name: the provider just confirmed
      // rawName against the PDF, so it — not any stale client-sent analyteId —
      // decides the dictionary match. No match = honestly "not covered" (FR-04).
      const analyte = matchAnalyte(row.rawName);
      const refLow = toNumber(row.refLow);
      const refHigh = toNumber(row.refHigh);
      const unit = row.unit.trim() === '' ? undefined : row.unit;
      return {
        id: row.id,
        reportId,
        rawName: row.rawName,
        analyteId: analyte?.id,
        value: row.value,
        unit,
        refLow,
        refHigh,
        rawRange: row.rawRange.trim() === '' ? undefined : row.rawRange,
        labFlags: row.labFlags,
        lowConfidenceFields: [],
        classification: classifyRow({
          value: row.value,
          unit,
          refLow,
          refHigh,
          labFlags: row.labFlags,
          analyte,
        }),
      };
    });

  await saveRows(reportId, rows);
  await setReportStatus(reportId, 'verified');
  await draftFromVerifiedRows(reportId, rows);
  revalidatePath(reportPath(reportId));
}

/**
 * The one post-verification drafting step, shared by confirmVerificationAction
 * and retryDraftAction so the two paths cannot drift. Team model: a critical
 * result holds the report — nothing is drafted or sent (FR-07). Otherwise draft
 * the patient explanation from the verified rows (FR-09); a drafting failure —
 * an LLM error or a failed structural check — must not throw out of a gate that
 * already succeeded, so the report stays 'verified' (the pre-draft state, shown
 * as retryable on the report page) and only advances to 'drafted' on a clean
 * draft. No logging in the failure path — never route lab values to logs
 * (safety rule 5).
 */
async function draftFromVerifiedRows(reportId: string, rows: ResultRow[]): Promise<void> {
  if (await reportHasCritical(reportId)) {
    await setReportStatus(reportId, 'held');
    return;
  }
  try {
    const draft = await draftExplanation({ rows });
    await saveExplanation(reportId, draft);
    await setReportStatus(reportId, 'drafted');
  } catch {
    // Draft failed; report stays 'verified' and drafting can be retried.
  }
}

/**
 * Retry drafting for a report stuck at 'verified' (a prior draft attempt
 * failed). Status-guarded: from 'verified' only, so it can never re-draft an
 * already-drafted or approved report. Rows are already provider-verified and
 * classified (FR-05/FR-06); this re-runs only the drafting step.
 */
export async function retryDraftAction(formData: FormData): Promise<void> {
  const reportId = String(formData.get('reportId') ?? '');
  const report = await getReport(reportId);
  if (report === null || report.status !== 'verified') return;
  const rows = await getRows(reportId);
  await draftFromVerifiedRows(reportId, rows);
  revalidatePath(reportPath(reportId));
}

export async function resetReportAction(formData: FormData): Promise<void> {
  const reportId = String(formData.get('reportId') ?? '');
  await resetReport(reportId);
  revalidatePath(reportPath(reportId));
}

/**
 * Record that the provider contacted the patient about a critical result (FR-07).
 * Documentation only: it never lifts the hold, drafts, or sends. Guards re-derive
 * the report's real state and criticals from stored rows, never trusting the form:
 * a report that is not held, or an analyte that is not genuinely critical for it,
 * is refused. The note is stored but never logged (safety rule 5).
 */
export async function logOutreachAction(formData: FormData): Promise<void> {
  const reportId = String(formData.get('reportId') ?? '');
  const report = await getReport(reportId);
  if (report === null || report.status !== 'held') return;

  const analyteId = String(formData.get('analyteId') ?? '');
  const rows = await getRows(reportId);
  if (!criticalAnalyteIds(rows).includes(analyteId)) return;

  const method = String(formData.get('method') ?? '');
  if (method !== 'phone' && method !== 'other') return;

  const note = String(formData.get('note') ?? '').trim();
  if (note === '' || note.length > OUTREACH_NOTE_MAX) return;

  await addOutreach(reportId, {
    reportId,
    analyteId,
    method: method as OutreachMethod,
    note,
    at: new Date().toISOString(),
  });
  revalidatePath(reportPath(reportId));
}

/**
 * Read the provider's edited wording out of the review form, falling back to the
 * drafted text for any field left untouched. Sources are carried through
 * unchanged: they are built deterministically from the grounding, never edited
 * here (safety rule 1).
 */
function parseDraftEdits(
  formData: FormData,
  explanation: Explanation,
): Pick<Explanation, 'overallText' | 'perTest' | 'sources'> {
  return {
    overallText: String(formData.get('overallText') ?? explanation.overallText),
    perTest: explanation.perTest.map((entry) => ({
      analyteId: entry.analyteId,
      text: String(formData.get(`text-${entry.analyteId}`) ?? entry.text),
    })),
    sources: explanation.sources,
  };
}

/**
 * Save the provider's wording edits while the report is still a draft. The
 * report stays 'drafted' (unapproved); the approval gate is a separate action.
 * Approved explanations are frozen (FR-10), so an approved record is never
 * touched here; the write layer also refuses it as defense in depth.
 */
export async function saveDraftAction(formData: FormData): Promise<void> {
  const reportId = String(formData.get('reportId') ?? '');
  const explanation = await getExplanation(reportId);
  if (explanation !== null && explanation.status !== 'approved') {
    await saveExplanation(reportId, parseDraftEdits(formData, explanation));
  }
  revalidatePath(reportPath(reportId));
}

export async function approveDraftAction(formData: FormData): Promise<void> {
  const reportId = String(formData.get('reportId') ?? '');
  // Persist any final wording edits, then freeze as approved (gate 2, FR-10).
  const explanation = await getExplanation(reportId);
  if (explanation !== null && explanation.status !== 'approved') {
    await saveExplanation(reportId, parseDraftEdits(formData, explanation));
  }
  await approveExplanation(reportId);
  await setReportStatus(reportId, 'approved');
  revalidatePath(reportPath(reportId));
}

export async function sendLinkAction(formData: FormData): Promise<void> {
  const reportId = String(formData.get('reportId') ?? '');
  await createShareLink(reportId);
  // Notify the patient their results are ready. Offline this records the event only;
  // the link and token are never passed to or logged by the email seam (safety rule 5).
  await sendShareLink();
  await setReportStatus(reportId, 'sent');
  revalidatePath(reportPath(reportId));
}
