import 'server-only';

import { randomBytes } from 'node:crypto';
import type { PostgrestError } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { isExpired, SHARE_LINK_TTL_MS } from '@/lib/share-link';
import type { Explanation, PatientInfo, ReportStatus, ResultRow } from '@/lib/types';
import {
  type DataLayer,
  type ExplanationRow,
  type OutreachRow,
  type ReportRow,
  type ResultRowRow,
  type ShareLinkRow,
  explanationFromRow,
  outreachFromRow,
  outreachToInsert,
  reportFromRow,
  reportToInsert,
  resultRowFromRow,
  resultRowToInsert,
  shareLinkFromRow,
} from './mapping';

/**
 * The Supabase-backed data layer: the same seam as the mock (index.ts delegates to
 * whichever the environment selects), reading and writing the tables in
 * supabase/migrations. 'server-only' keeps the secret-key admin client out of any
 * client bundle. Every function is typed against DataLayer so a signature can't drift
 * from the mock; index.ts's `Promise<DataLayer>` return also fails the build if one is
 * missing. Column-name translation lives entirely in ./mapping.
 *
 * Safety rule 5: never log a token, DOB, note, or lab value here. Errors surface Postgres
 * messages (constraint/column names), which carry no row data, and are thrown, not logged.
 */

let client: ReturnType<typeof createSupabaseAdminClient> | undefined;
function db() {
  return (client ??= createSupabaseAdminClient());
}

/** Throw on a query error. The message is a Postgres error string — no row data. */
function ensure(context: string, error: PostgrestError | null): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const listReports: DataLayer['listReports'] = async () => {
  const { data, error } = await db()
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });
  ensure('listReports', error);
  return (data as ReportRow[]).map(reportFromRow);
};

export const getReport: DataLayer['getReport'] = async (id) => {
  const { data, error } = await db().from('reports').select('*').eq('id', id).maybeSingle();
  ensure('getReport', error);
  return data ? reportFromRow(data as ReportRow) : null;
};

export const getRows: DataLayer['getRows'] = async (reportId) => {
  const { data, error } = await db()
    .from('result_rows')
    .select('*')
    .eq('report_id', reportId)
    .order('ordinal', { ascending: true });
  ensure('getRows', error);
  return (data as ResultRowRow[]).map(resultRowFromRow);
};

export const getExplanation: DataLayer['getExplanation'] = async (reportId) => {
  const { data, error } = await db()
    .from('explanations')
    .select('*')
    .eq('report_id', reportId)
    .maybeSingle();
  ensure('getExplanation', error);
  return data ? explanationFromRow(data as ExplanationRow) : null;
};

export const getShareLinkByToken: DataLayer['getShareLinkByToken'] = async (token) => {
  const { data, error } = await db()
    .from('share_links')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  ensure('getShareLinkByToken', error);
  return data ? shareLinkFromRow(data as ShareLinkRow) : null;
};

export const getShareLinkByReport: DataLayer['getShareLinkByReport'] = async (reportId) => {
  // Provider-facing lookup: only the live link (there is at most one — the 0004 partial
  // unique index). Tombstoned links stay reachable by token so the old emailed URL
  // renders ExpiredNotice, never a 404.
  const { data, error } = await db()
    .from('share_links')
    .select('*')
    .eq('report_id', reportId)
    .is('superseded_at', null)
    .maybeSingle();
  ensure('getShareLinkByReport', error);
  return data ? shareLinkFromRow(data as ShareLinkRow) : null;
};

export const markShareLinkOpened: DataLayer['markShareLinkOpened'] = async (token) => {
  // First confirm wins, atomically: only set opened_at when still null (FR-11). The
  // token is a filter value, never logged. Callers treat this as best-effort — an audit
  // timestamp must never block an authenticated patient from their results.
  const { error } = await db()
    .from('share_links')
    .update({ opened_at: new Date().toISOString() })
    .eq('token', token)
    .is('opened_at', null);
  ensure('markShareLinkOpened', error);
};

export const getOutreach: DataLayer['getOutreach'] = async (reportId) => {
  const { data, error } = await db()
    .from('outreach')
    .select('*')
    .eq('report_id', reportId)
    .order('at', { ascending: true });
  ensure('getOutreach', error);
  return (data as OutreachRow[]).map(outreachFromRow);
};

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export const createReport: DataLayer['createReport'] = async (
  patient: PatientInfo,
  pdfRef: string,
) => {
  // .select().single() is required: a bare insert returns no row, and the caller
  // redirects on the returned report's id.
  const { data, error } = await db()
    .from('reports')
    .insert(reportToInsert(patient, pdfRef))
    .select('*')
    .single();
  ensure('createReport', error);
  return reportFromRow(data as ReportRow);
};

export const saveRows: DataLayer['saveRows'] = async (reportId, rows: ResultRow[]) => {
  // Replace the report's rows wholesale (matches the mock). The ordinal is the array
  // index so getRows returns them in the verified order regardless of insert timing.
  const del = await db().from('result_rows').delete().eq('report_id', reportId);
  ensure('saveRows.delete', del.error);
  if (rows.length === 0) return;
  const payload = rows.map((row, index) => resultRowToInsert(reportId, row, index));
  const ins = await db().from('result_rows').insert(payload);
  ensure('saveRows.insert', ins.error);
};

export const resetReport: DataLayer['resetReport'] = async (reportId) => {
  // The report row is kept, so ON DELETE CASCADE never fires — delete the children
  // explicitly, then return the report to the start of the workflow.
  for (const table of ['result_rows', 'explanations', 'share_links', 'outreach'] as const) {
    const { error } = await db().from(table).delete().eq('report_id', reportId);
    ensure(`resetReport.${table}`, error);
  }
  const { error } = await db()
    .from('reports')
    .update({ status: 'uploaded' satisfies ReportStatus })
    .eq('id', reportId);
  ensure('resetReport.status', error);
};

export const addOutreach: DataLayer['addOutreach'] = async (reportId, entry) => {
  const { error } = await db().from('outreach').insert(outreachToInsert(reportId, entry));
  ensure('addOutreach', error);
};

export const setReportStatus: DataLayer['setReportStatus'] = async (
  reportId,
  status: ReportStatus,
) => {
  // updated_at is maintained by the reports_set_updated_at trigger (0001).
  const { error } = await db().from('reports').update({ status }).eq('id', reportId);
  ensure('setReportStatus', error);
};

export const saveExplanation: DataLayer['saveExplanation'] = async (
  reportId,
  content: Pick<Explanation, 'overallText' | 'perTest' | 'sources'>,
) => {
  // Freeze guard (FR-10): an approved explanation is never overwritten. The sanctioned
  // re-draft route is resetReport, which deletes the explanation (clearing approval)
  // first. Message matches the mock so both drivers fail identically.
  const existing = await db()
    .from('explanations')
    .select('status')
    .eq('report_id', reportId)
    .maybeSingle();
  ensure('saveExplanation.read', existing.error);
  if ((existing.data as { status: string } | null)?.status === 'approved') {
    throw new Error(
      'refusing to overwrite an approved explanation: approved records are frozen (FR-10)',
    );
  }
  // Upsert on the unique report_id: a re-draft replaces the prior draft and resets it
  // to unapproved (status draft, approved_at null), matching the mock.
  const { error } = await db().from('explanations').upsert(
    {
      report_id: reportId,
      overall_text: content.overallText,
      per_test: content.perTest,
      sources: content.sources,
      status: 'draft',
      approved_at: null,
    },
    { onConflict: 'report_id' },
  );
  ensure('saveExplanation.write', error);
};

export const approveExplanation: DataLayer['approveExplanation'] = async (reportId) => {
  const { error } = await db()
    .from('explanations')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('report_id', reportId);
  ensure('approveExplanation', error);
};

export const createShareLink: DataLayer['createShareLink'] = async (reportId) => {
  // One live link per report (matches the mock): reuse a live link; tombstone an expired
  // one — kept so the already-emailed URL keeps resolving to ExpiredNotice, never a
  // 404 — and issue a fresh, openable link in its place (FR-11).
  const existing = await getShareLinkByReport(reportId);
  if (existing !== null) {
    if (!isExpired(existing.expiresAt)) return existing;
    const tombstone = await db()
      .from('share_links')
      .update({ superseded_at: new Date().toISOString() })
      .eq('id', existing.id);
    ensure('createShareLink.supersedeExpired', tombstone.error);
  }
  const { data, error } = await db()
    .from('share_links')
    .insert({
      report_id: reportId,
      token: randomBytes(18).toString('base64url'),
      expires_at: new Date(Date.now() + SHARE_LINK_TTL_MS).toISOString(),
    })
    .select('*')
    .single();
  // One live link per report is enforced by the database (0004 partial unique index —
  // tombstones don't count). A unique violation means a concurrent call won the insert
  // race — return its row rather than failing the send.
  if (error?.code === '23505') {
    const winner = await getShareLinkByReport(reportId);
    if (winner !== null) return winner;
  }
  ensure('createShareLink', error);
  return shareLinkFromRow(data as ShareLinkRow);
};
