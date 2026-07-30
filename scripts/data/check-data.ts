/**
 * Data-layer proof — the live counterpart to the unit tests, which only ever run the
 * mock. It drives the REAL Supabase driver (src/lib/data/supabase.ts) against a real
 * project and round-trips every store, so the swap's invariants are measured, not
 * asserted: db-generated ids, row ordering, the freeze guard, share-link idempotency,
 * and resetReport clearing children.
 *
 * Opt-in, run by hand (like eval:extract / seed), never in CI:
 *   npm run check:data     — needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY in
 *                            .env.local, and migrations 0001–0004 applied.
 *
 * It imports supabase.ts directly, so it exercises the live path even when DATA_OFFLINE
 * is set (that toggle only steers index.ts). supabase.ts is 'server-only'; the npm
 * script runs Node with --conditions=react-server, under which server-only resolves to
 * an empty module (same mechanism as eval:extract).
 *
 * Safety rule 5: this script prints only PASS/FAIL, statuses, and counts — never a note,
 * token, DOB, or lab value, even the synthetic ones it writes. It cleans up the test
 * report in a finally so a failed run leaves nothing behind.
 */

import type { Classification, ResultRow } from '@/lib/types';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import {
  addOutreach,
  approveExplanation,
  createReport,
  createShareLink,
  getExplanation,
  getOutreach,
  getReport,
  getRows,
  getShareLinkByReport,
  getShareLinkByToken,
  markShareLinkOpened,
  resetReport,
  saveExplanation,
  saveRows,
  setReportStatus,
} from '@/lib/data/supabase';

let failures = 0;
function check(label: string, ok: boolean, safeDetail = ''): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && safeDetail ? ` — ${safeDetail}` : ''}`);
  if (!ok) failures += 1;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function syntheticRows(reportId: string): ResultRow[] {
  const range: Classification = { kind: 'range', band: 'above', critical: false };
  // Deliberate order chk-1, chk-2, chk-3 — read back must preserve it (ordinal).
  return [
    {
      id: 'ignored-1',
      reportId,
      rawName: 'chk-1',
      analyteId: 'potassium',
      value: '4.2',
      unit: 'mmol/L',
      refLow: 3.5,
      refHigh: 5.1,
      labFlags: [],
      lowConfidenceFields: [],
      classification: range,
    },
    {
      id: 'ignored-2',
      reportId,
      rawName: 'chk-2',
      // no analyteId / classification: proves null -> undefined on read
      value: 'n/a',
      labFlags: [],
      lowConfidenceFields: [],
    },
    {
      id: 'ignored-3',
      reportId,
      rawName: 'chk-3',
      analyteId: 'sodium',
      value: '140',
      unit: 'mmol/L',
      labFlags: [],
      lowConfidenceFields: [],
      classification: { kind: 'range', band: 'in', critical: false },
    },
  ];
}

async function main(): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    console.log(
      'check:data — no Supabase env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY). ' +
        'Set them in .env.local to run. Skipping.',
    );
    return;
  }

  const admin = createSupabaseAdminClient();
  let reportId: string | undefined;

  try {
    // --- createReport: db-generated id (proves .select().single()) ---
    const report = await createReport(
      { name: 'Check Script', email: 'check.script@example.test', dob: '1990-01-01' },
      'check-data-ref',
    );
    reportId = report.id;
    check('createReport returns a db-generated id', Boolean(report.id) && report.id.length > 0);
    check('createReport starts at status uploaded', report.status === 'uploaded');

    // --- saveRows / getRows: ordering + null->undefined mapping ---
    await saveRows(report.id, syntheticRows(report.id));
    const rows = await getRows(report.id);
    check('getRows returns all saved rows', rows.length === 3, `got ${rows.length}`);
    check(
      'getRows preserves the saved order (ordinal)',
      rows.map((r) => r.rawName).join(',') === 'chk-1,chk-2,chk-3',
    );
    const bare = rows.find((r) => r.rawName === 'chk-2');
    check(
      'null columns read back as undefined',
      bare !== undefined && bare.analyteId === undefined && bare.classification === undefined,
    );
    const classified = rows.find((r) => r.rawName === 'chk-1');
    check(
      'stored classification round-trips',
      classified?.classification?.kind === 'range' &&
        classified.classification.band === 'above' &&
        classified.classification.critical === false,
    );

    // --- explanation: draft -> approve -> freeze ---
    await setReportStatus(report.id, 'drafted');
    await saveExplanation(report.id, {
      overallText: 'Synthetic check explanation.',
      perTest: [{ analyteId: 'potassium', text: 'Synthetic per-test text.' }],
      sources: [{ analyteId: 'potassium', title: 'Potassium', url: 'https://medlineplus.gov/' }],
    });
    check('getExplanation returns a draft', (await getExplanation(report.id))?.status === 'draft');

    await approveExplanation(report.id);
    check(
      'approveExplanation sets status approved',
      (await getExplanation(report.id))?.status === 'approved',
    );

    let froze = false;
    try {
      await saveExplanation(report.id, {
        overallText: 'Should be refused.',
        perTest: [],
        sources: [],
      });
    } catch {
      froze = true;
    }
    check('freeze guard refuses to overwrite an approved explanation', froze);
    check(
      'approved explanation left intact after refusal',
      (await getExplanation(report.id))?.overallText === 'Synthetic check explanation.',
    );

    // --- share link: idempotent (one per report) + ~30 day expiry ---
    const link1 = await createShareLink(report.id);
    const link2 = await createShareLink(report.id);
    check('createShareLink is idempotent per report', link1.token === link2.token);
    const ttlDays = (new Date(link1.expiresAt).getTime() - Date.now()) / DAY_MS;
    check('share link expires in ~30 days', ttlDays > 29 && ttlDays < 31);

    // --- markShareLinkOpened: first open wins, never overwritten ---
    await markShareLinkOpened(link1.token);
    const firstOpen = (await getShareLinkByToken(link1.token))?.openedAt;
    check('markShareLinkOpened stamps openedAt on first open', firstOpen !== undefined);
    await markShareLinkOpened(link1.token);
    const secondOpen = (await getShareLinkByToken(link1.token))?.openedAt;
    check('markShareLinkOpened never overwrites the first open', secondOpen === firstOpen);

    // --- expired-link regeneration ---
    // Force the link expired directly, then a re-send must mint a fresh token.
    const expire = await admin
      .from('share_links')
      .update({ expires_at: '2000-01-01T00:00:00.000Z' })
      .eq('report_id', report.id);
    if (expire.error) {
      console.log(`setup: could not expire the link (${expire.error.message})`);
      failures += 1;
    }
    const regenerated = await createShareLink(report.id);
    check('createShareLink regenerates an expired link', regenerated.token !== link1.token);
    check(
      'the regenerated link is unexpired',
      new Date(regenerated.expiresAt).getTime() > Date.now(),
    );

    // --- tombstone: the superseded link stays reachable by token (FR-11) ---
    const tombstone = await getShareLinkByToken(link1.token);
    check(
      'the superseded link remains findable by token (tombstone, not 404)',
      tombstone !== null && tombstone.supersededAt !== undefined,
    );
    check(
      'getShareLinkByReport returns only the live link',
      (await getShareLinkByReport(report.id))?.token === regenerated.token,
    );

    // --- one LIVE link per report is a DATABASE guarantee (0004 partial unique index) ---
    const dup = await admin.from('share_links').insert({
      report_id: report.id,
      token: `dup-check-${Date.now()}`,
      expires_at: new Date(Date.now() + DAY_MS).toISOString(),
    });
    check(
      'database refuses a second share link for the same report',
      dup.error?.code === '23505',
      dup.error ? `got error ${dup.error.code}` : 'insert unexpectedly succeeded',
    );

    // --- outreach ---
    await addOutreach(report.id, {
      reportId: report.id,
      analyteId: 'potassium',
      method: 'phone',
      note: 'Synthetic contact note.',
      at: new Date().toISOString(),
    });
    check('getOutreach returns the logged contact', (await getOutreach(report.id)).length === 1);

    // --- resetReport clears every child explicitly (no cascade on a kept report) ---
    await resetReport(report.id);
    check('resetReport clears rows', (await getRows(report.id)).length === 0);
    check('resetReport clears the explanation', (await getExplanation(report.id)) === null);
    check('resetReport clears share links', (await getShareLinkByReport(report.id)) === null);
    check('resetReport clears outreach', (await getOutreach(report.id)).length === 0);
    check(
      'resetReport returns the report to uploaded',
      (await getReport(report.id))?.status === 'uploaded',
    );
  } finally {
    if (reportId) {
      const { error } = await admin.from('reports').delete().eq('id', reportId);
      if (error) {
        console.log(`cleanup: failed to delete test report (${error.message})`);
        failures += 1;
      } else {
        check('cleanup removed the test report', (await getReport(reportId)) === null);
      }
    }
  }

  console.log(
    failures === 0 ? '\nAll data-layer checks passed.' : `\n${failures} check(s) FAILED.`,
  );
  if (failures > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
