import type { ResultRow } from '@/lib/types';

/**
 * Pairing the approved explanation back to the rows it describes, for the provider's review
 * and approve screens.
 *
 * Two rows on one report can carry the same analyte id — the dictionary matches each printed
 * line independently, and glucose alone lists both "Glucose" and "Glucose, fasting" as
 * aliases. So an analyte id is not a row identity, and matching on it silently conflates the
 * two: an explained row would suppress its unexplained twin, which is exactly what must not
 * happen at a gate whose job is to show everything the patient will see (FR-10).
 */

/**
 * The row each explanation entry is about. Only `range` rows are ever drafted
 * (src/lib/draft/build-input.ts), so an entry describes the range-classified row for that
 * analyte, never an implausible or unreadable line printing the same test. Two *range* rows
 * sharing an analyte id cannot reach these screens — assertPerTestMatches rejects that draft
 * before the report is stored — so this mapping is unambiguous where it is used.
 */
export function draftedRowByAnalyte(rows: ResultRow[]): Map<string, ResultRow> {
  return new Map(
    rows
      .filter((row) => row.analyteId !== undefined && row.classification?.kind === 'range')
      .map((row) => [row.analyteId as string, row]),
  );
}

/**
 * The rows the explanation text does not cover, in report order — matched by row id, not
 * analyte id. These still reach the patient, each rendered from its own classification.
 */
export function rowsOutsideExplanation(
  rows: ResultRow[],
  perTest: readonly { analyteId: string }[],
): ResultRow[] {
  const byAnalyte = draftedRowByAnalyte(rows);
  const explainedRowIds = new Set(
    perTest
      .map((entry) => byAnalyte.get(entry.analyteId)?.id)
      .filter((id): id is string => id !== undefined),
  );
  return rows.filter((row) => !explainedRowIds.has(row.id));
}
