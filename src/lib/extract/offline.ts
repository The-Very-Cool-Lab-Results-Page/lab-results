import manualEntry from './fixtures/manual-entry.json';
import reyesAnnualCmp from './fixtures/reyes-annual-cmp.json';
import { extractionSchema, type ExtractionResult } from './schema';

/**
 * The offline extraction path: pre-authored synthetic fixtures instead of a live
 * model call, so the whole provider flow runs on localhost and in CI with no API
 * key. Fixtures pass through the same schema as a live response, so a malformed
 * fixture fails the same way. This path is for building and tests only — it does
 * not measure extraction accuracy (that's the synthetic PDF corpus + eval, later).
 *
 * Fixtures are imported statically (not read from disk) so they bundle cleanly on
 * Vercel — matching the analyte dictionary's static-import approach. No `fs`, no
 * vendor SDK, no `server-only`: this module is safe to import from tests.
 */
const OFFLINE_FIXTURES: Record<string, unknown> = {
  'manual-entry': manualEntry,
  // Transcribes the liver-metabolic corpus PDF, so LLM_OFFLINE=1 is a drop-in fallback for
  // the one demo report that gets extracted. A copy of that corpus expected output —
  // extract.test.ts fails if the two drift. The other seeded reports are past extraction,
  // so they have no fixture and cannot be re-read offline after a reset.
  'reyes-annual-cmp': reyesAnnualCmp,
};

/** The synthetic report refs available offline (one per fixture). */
export function availablePdfRefs(): string[] {
  return Object.keys(OFFLINE_FIXTURES).sort();
}

export function offlineExtract(pdfRef: string): ExtractionResult {
  const fixture = OFFLINE_FIXTURES[pdfRef];
  if (fixture === undefined) {
    throw new Error(`No synthetic extraction fixture for pdfRef "${pdfRef}"`);
  }
  return extractionSchema.parse(fixture);
}
