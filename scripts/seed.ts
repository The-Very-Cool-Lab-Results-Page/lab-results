/**
 * Seed script — mirrors the six walked demo states into Supabase.
 *
 * Delete-then-recreate, not upsert: a re-run wipes `reports` (every child table cascades)
 * and rebuilds from scratch, so a half-walked rehearsal resets to a known state. Fixed
 * report ids and verbatim share-link tokens mean report URLs and patient links survive a
 * reseed. A partial failure leaves reports without children — re-run to converge.
 *
 * Run with `npm run seed` (loads .env.local via --env-file; fails loudly if missing).
 * Requires migrations 0001-0004 applied.
 *
 * The fixture data is imported from src/lib/data/mock.ts, which is the single source of
 * truth for the demo roster — only the slug-to-uuid map lives here, because the mock uses
 * readable slugs while the tables use uuid primary keys.
 *
 * Only needed for Supabase mode. The demo itself runs on DATA_OFFLINE=1, which serves the
 * same mock in-process; this exists so Supabase-mode dev and rehearsal see the same states.
 *
 * Synthetic data only (FR-15). Built as if it were real PHI anyway: the summary prints no
 * DOBs, no share-link tokens, and no lab values (safety rule 5).
 *
 * This is a plain Node script, not Next.js runtime, so it can't import
 * src/lib/supabase/server.ts or src/lib/data/supabase.ts (both guarded by 'server-only');
 * it builds its own admin client with the same env names.
 *
 * The seeded auth user is forward-looking: today's sign-in is the demo stand-in in
 * src/lib/auth/session.ts, which never consults Supabase auth.
 */

import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '../src/lib/supabase/env';
import { MOCK_EXPLANATIONS, MOCK_REPORTS, MOCK_ROWS, MOCK_SHARE_LINKS } from '../src/lib/data/mock';
import {
  resultRowToInsert,
  type ExplanationRow,
  type ReportRow,
  type ShareLinkRow,
} from '../src/lib/data/mapping';

/**
 * Kept in step with src/lib/auth/session.ts, which owns these — it reads the same two env
 * vars with the same defaults, and it is the only thing that actually accepts a login. Change
 * one and change the other, or this script prints credentials sign-in would reject (the
 * previous version advertised provider@demo.example, which never worked).
 */
const DEMO_PROVIDER_EMAIL = process.env.DEMO_PROVIDER_EMAIL ?? 'dr.anderson@demo.clinic';
const DEMO_PROVIDER_PASSWORD = process.env.DEMO_PROVIDER_PASSWORD ?? 'demo-password-2026';

/** Stable, so report URLs do not change across reseeds. */
const REPORT_IDS: Record<string, string> = {
  'rpt-alvarez': '00000000-0000-4000-8000-000000000101',
  'rpt-chen': '00000000-0000-4000-8000-000000000102',
  'rpt-okoro': '00000000-0000-4000-8000-000000000103',
  'rpt-reyes': '00000000-0000-4000-8000-000000000104',
  'rpt-nguyen': '00000000-0000-4000-8000-000000000105',
  'rpt-park': '00000000-0000-4000-8000-000000000106',
};

/** A roster change in mock.ts must fail here rather than silently seed a partial demo. */
function reportId(mockId: string): string {
  const id = REPORT_IDS[mockId];
  if (id === undefined) {
    throw new Error(
      `No seed uuid for report "${mockId}" — add it to REPORT_IDS in scripts/seed.ts.`,
    );
  }
  return id;
}

async function main() {
  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    requireEnv('SUPABASE_SECRET_KEY', process.env.SUPABASE_SECRET_KEY),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error: userError } = await supabase.auth.admin.createUser({
    email: DEMO_PROVIDER_EMAIL,
    password: DEMO_PROVIDER_PASSWORD,
    email_confirm: true,
  });
  if (userError && userError.code !== 'email_exists') {
    throw new Error(`Failed to create demo provider: ${userError.message}`);
  }
  console.log(
    userError
      ? `Demo provider already exists: ${DEMO_PROVIDER_EMAIL}`
      : `Created demo provider: ${DEMO_PROVIDER_EMAIL}`,
  );

  // PostgREST requires a filter on delete, so match every row on a column that is never
  // null. Child tables cascade (migrations 0001/0002), which also clears reports created
  // by earlier seeds or by walking the demo.
  const { error: deleteError } = await supabase
    .from('reports')
    .delete()
    .gte('created_at', '1970-01-01T00:00:00.000Z');
  if (deleteError) {
    throw new Error(`Failed to clear existing reports: ${deleteError.message}`);
  }

  const reportRows: ReportRow[] = MOCK_REPORTS.map((report) => ({
    id: reportId(report.id),
    patient_name: report.patient.name,
    patient_email: report.patient.email,
    patient_dob: report.patient.dob,
    pdf_ref: report.pdfRef,
    status: report.status,
    created_at: report.createdAt,
    updated_at: report.updatedAt,
  }));
  const { error: reportError } = await supabase.from('reports').insert(reportRows);
  if (reportError) {
    throw new Error(`Failed to insert reports: ${reportError.message}`);
  }

  let rowCount = 0;
  for (const report of MOCK_REPORTS) {
    const rows = MOCK_ROWS[report.id] ?? [];
    if (rows.length === 0) continue; // the fresh report has nothing extracted yet
    const { error } = await supabase
      .from('result_rows')
      .insert(rows.map((row, index) => resultRowToInsert(reportId(report.id), row, index)));
    if (error) {
      throw new Error(`Failed to insert result rows for ${report.patient.name}: ${error.message}`);
    }
    rowCount += rows.length;
  }

  // Inserted directly rather than through approveExplanation, which would stamp approval
  // with now() instead of the mock's fixed timestamps.
  const explanationRows: Omit<ExplanationRow, 'id'>[] = Object.entries(MOCK_EXPLANATIONS).map(
    ([mockId, explanation]) => ({
      report_id: reportId(mockId),
      overall_text: explanation.overallText,
      per_test: explanation.perTest,
      sources: explanation.sources,
      status: explanation.status,
      approved_at: explanation.approvedAt ?? null,
    }),
  );
  const { error: explanationError } = await supabase.from('explanations').insert(explanationRows);
  if (explanationError) {
    throw new Error(`Failed to insert explanations: ${explanationError.message}`);
  }

  // Verbatim tokens, unlike createShareLink which generates a random one — the demo's
  // patient URLs are written down in the demo script and must survive a reseed.
  const shareLinkRows: Omit<ShareLinkRow, 'id'>[] = MOCK_SHARE_LINKS.map((link) => ({
    report_id: reportId(link.reportId),
    token: link.token,
    expires_at: link.expiresAt,
    opened_at: link.openedAt ?? null,
    superseded_at: link.supersededAt ?? null,
  }));
  const { error: shareLinkError } = await supabase.from('share_links').insert(shareLinkRows);
  if (shareLinkError) {
    throw new Error(`Failed to insert share links: ${shareLinkError.message}`);
  }

  // No outreach rows: the held report starts with its contact still to be logged, matching
  // MOCK_OUTREACH. The delete above already removed any logged during a previous walk.

  console.log(`\nSeeded ${reportRows.length} reports:`);
  for (const report of MOCK_REPORTS) {
    const detail = [`${MOCK_ROWS[report.id]?.length ?? 0} result rows`];
    if (MOCK_EXPLANATIONS[report.id]) detail.push('explanation');
    if (MOCK_SHARE_LINKS.some((link) => link.reportId === report.id)) detail.push('share link');
    console.log(
      `  ${reportId(report.id)}  ${report.patient.name.padEnd(14)} ` +
        `${report.status.padEnd(9)} (${detail.join(', ')})`,
    );
  }
  console.log(
    `\n${rowCount} result rows, ${explanationRows.length} explanations, ` +
      `${shareLinkRows.length} share links.`,
  );
  console.log(`\nDemo login: ${DEMO_PROVIDER_EMAIL} / ${DEMO_PROVIDER_PASSWORD}`);
  console.log(
    'The fresh report has no stored PDF: attach tests/extraction/liver-metabolic-quest/report.pdf\n' +
      'at its read step for the live path (nothing reads the report-pdfs bucket, so none is seeded).',
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
