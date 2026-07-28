import { randomBytes } from 'node:crypto';
import type { Explanation, PatientInfo, Report, ReportStatus, ResultRow } from '@/lib/types';
import { isExpired, SHARE_LINK_TTL_MS } from '@/lib/share-link';
import type { DataLayer } from './mapping';
import {
  MOCK_EXPLANATIONS,
  MOCK_OUTREACH,
  MOCK_REPORTS,
  MOCK_ROWS,
  MOCK_SHARE_LINKS,
} from './mock';

/**
 * The web page's read/write layer. Two drivers implement the same DataLayer seam:
 * the in-memory mock below, and the Supabase-backed ./supabase. index.ts picks one
 * per call (see `layer()`); the screens never change.
 *
 * Offline by default: with DATA_OFFLINE=1, or without both Supabase env vars, the mock
 * runs so the app (and CI/E2E) works with no credentials — mirroring how llm.ts and the
 * extractor gate the live path. The Supabase driver imports 'server-only', so it is
 * loaded dynamically: a static import would crash the plain-Node vitest suites that
 * import this file.
 */

// ---------------------------------------------------------------------------
// Mock driver (offline default)
// ---------------------------------------------------------------------------

/**
 * Mock writes mutate the in-memory data so the provider workflow can be clicked
 * through within a dev session (state resets on restart). The Supabase driver is the
 * persistent counterpart; both satisfy DataLayer, so this object is also the reference
 * that documents each function's intended behavior.
 */
const mockLayer: DataLayer = {
  async listReports() {
    return [...MOCK_REPORTS].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getReport(id) {
    return MOCK_REPORTS.find((report) => report.id === id) ?? null;
  },

  async getRows(reportId) {
    return MOCK_ROWS[reportId] ?? [];
  },

  async getExplanation(reportId) {
    return MOCK_EXPLANATIONS[reportId] ?? null;
  },

  async getShareLinkByToken(token) {
    return MOCK_SHARE_LINKS.find((link) => link.token === token) ?? null;
  },

  async getShareLinkByReport(reportId) {
    // Provider-facing lookup: only the live link. Tombstoned (superseded) links stay
    // reachable by token so the old emailed URL renders ExpiredNotice, never a 404.
    return (
      MOCK_SHARE_LINKS.find(
        (link) => link.reportId === reportId && link.supersededAt === undefined,
      ) ?? null
    );
  },

  async getOutreach(reportId) {
    return MOCK_OUTREACH[reportId] ?? [];
  },

  async createReport(patient: PatientInfo, pdfRef: string) {
    const now = new Date().toISOString();
    const report: Report = {
      id: `rpt-${randomBytes(4).toString('hex')}`,
      patient,
      pdfRef,
      status: 'uploaded',
      createdAt: now,
      updatedAt: now,
    };
    MOCK_REPORTS.push(report);
    return report;
  },

  async saveRows(reportId, rows: ResultRow[]) {
    MOCK_ROWS[reportId] = rows;
  },

  async resetReport(reportId) {
    const report = MOCK_REPORTS.find((candidate) => candidate.id === reportId);
    if (report === undefined) return;
    report.status = 'uploaded';
    report.updatedAt = new Date().toISOString();
    delete MOCK_ROWS[reportId];
    delete MOCK_EXPLANATIONS[reportId];
    delete MOCK_OUTREACH[reportId];
    for (let i = MOCK_SHARE_LINKS.length - 1; i >= 0; i -= 1) {
      if (MOCK_SHARE_LINKS[i].reportId === reportId) MOCK_SHARE_LINKS.splice(i, 1);
    }
  },

  async addOutreach(reportId, entry) {
    (MOCK_OUTREACH[reportId] ??= []).push(entry);
  },

  async setReportStatus(reportId, status: ReportStatus) {
    const report = MOCK_REPORTS.find((candidate) => candidate.id === reportId);
    if (report === undefined) return;
    report.status = status;
    report.updatedAt = new Date().toISOString();
  },

  async saveExplanation(
    reportId,
    content: Pick<Explanation, 'overallText' | 'perTest' | 'sources'>,
  ) {
    // Freeze guard (FR-10): approved explanations are frozen; a re-draft replaces a
    // prior draft only. The sanctioned re-draft route is resetReport, which deletes the
    // explanation (clearing approval) first. Enforced in the write layer so no caller
    // can bypass it; the Supabase driver keeps the identical guard and message.
    if (MOCK_EXPLANATIONS[reportId]?.status === 'approved') {
      throw new Error(
        'refusing to overwrite an approved explanation: approved records are frozen (FR-10)',
      );
    }
    MOCK_EXPLANATIONS[reportId] = {
      id: `exp-${reportId}`,
      reportId,
      status: 'draft',
      approvedAt: undefined,
      ...content,
    };
  },

  async approveExplanation(reportId) {
    const explanation = MOCK_EXPLANATIONS[reportId];
    if (explanation === undefined) return;
    explanation.status = 'approved';
    explanation.approvedAt = new Date().toISOString();
  },

  async createShareLink(reportId) {
    const existing = MOCK_SHARE_LINKS.find(
      (link) => link.reportId === reportId && link.supersededAt === undefined,
    );
    if (existing !== undefined) {
      // A live (unexpired) link is reused; an expired one is tombstoned — kept so the
      // already-emailed URL keeps resolving to ExpiredNotice, never a 404 — and a
      // fresh, openable link is issued in its place (FR-11).
      if (!isExpired(existing.expiresAt)) return existing;
      existing.supersededAt = new Date().toISOString();
    }
    const link = {
      id: `sl-${randomBytes(4).toString('hex')}`,
      reportId,
      token: randomBytes(18).toString('base64url'),
      expiresAt: new Date(Date.now() + SHARE_LINK_TTL_MS).toISOString(),
      openedAt: undefined,
      supersededAt: undefined,
    };
    MOCK_SHARE_LINKS.push(link);
    return link;
  },

  async markShareLinkOpened(token) {
    // First confirm wins: stamp openedAt once, never overwrite (FR-11). Never log token.
    const link = MOCK_SHARE_LINKS.find((candidate) => candidate.token === token);
    if (link !== undefined && link.openedAt === undefined) {
      link.openedAt = new Date().toISOString();
    }
  },
};

// ---------------------------------------------------------------------------
// Driver selection
// ---------------------------------------------------------------------------

/**
 * Whether the persistent Supabase driver is configured. DATA_OFFLINE=1 forces the mock
 * even when the env vars are present (keeps unit tests and E2E hermetic), mirroring
 * LLM_OFFLINE in llm.ts.
 */
function isLiveData(): boolean {
  if (process.env.DATA_OFFLINE === '1') return false;
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

/**
 * The active driver. The Supabase module is imported dynamically so its 'server-only'
 * dependency never loads on the mock path. The `Promise<DataLayer>` return also makes
 * a missing or mistyped Supabase export a build error.
 */
async function layer(): Promise<DataLayer> {
  if (isLiveData()) return import('./supabase');
  return mockLayer;
}

// ---------------------------------------------------------------------------
// Public seam — each delegates to the active driver
// ---------------------------------------------------------------------------

export const listReports: DataLayer['listReports'] = async () => (await layer()).listReports();

export const getReport: DataLayer['getReport'] = async (id) => (await layer()).getReport(id);

export const getRows: DataLayer['getRows'] = async (reportId) => (await layer()).getRows(reportId);

export const getExplanation: DataLayer['getExplanation'] = async (reportId) =>
  (await layer()).getExplanation(reportId);

export const getShareLinkByToken: DataLayer['getShareLinkByToken'] = async (token) =>
  (await layer()).getShareLinkByToken(token);

export const getShareLinkByReport: DataLayer['getShareLinkByReport'] = async (reportId) =>
  (await layer()).getShareLinkByReport(reportId);

export const markShareLinkOpened: DataLayer['markShareLinkOpened'] = async (token) =>
  (await layer()).markShareLinkOpened(token);

export const getOutreach: DataLayer['getOutreach'] = async (reportId) =>
  (await layer()).getOutreach(reportId);

export const createReport: DataLayer['createReport'] = async (patient, pdfRef) =>
  (await layer()).createReport(patient, pdfRef);

export const saveRows: DataLayer['saveRows'] = async (reportId, rows) =>
  (await layer()).saveRows(reportId, rows);

export const resetReport: DataLayer['resetReport'] = async (reportId) =>
  (await layer()).resetReport(reportId);

export const addOutreach: DataLayer['addOutreach'] = async (reportId, entry) =>
  (await layer()).addOutreach(reportId, entry);

export const setReportStatus: DataLayer['setReportStatus'] = async (reportId, status) =>
  (await layer()).setReportStatus(reportId, status);

export const saveExplanation: DataLayer['saveExplanation'] = async (reportId, content) =>
  (await layer()).saveExplanation(reportId, content);

export const approveExplanation: DataLayer['approveExplanation'] = async (reportId) =>
  (await layer()).approveExplanation(reportId);

export const createShareLink: DataLayer['createShareLink'] = async (reportId) =>
  (await layer()).createShareLink(reportId);

/**
 * Whether any of a report's rows classifies as critical (FR-07). Derived from getRows
 * so the critical-detection predicate lives in one place and rides on whichever driver
 * is active — never duplicated as a separate query.
 */
export async function reportHasCritical(reportId: string): Promise<boolean> {
  const rows = await getRows(reportId);
  return rows.some((row) => row.classification?.kind === 'range' && row.classification.critical);
}
