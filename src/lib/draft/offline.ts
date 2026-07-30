import type { DraftInputRow, DraftOutput } from './schema';

/**
 * The offline drafting path: a deterministic placeholder so the provider flow
 * runs on localhost and in CI with no API key (mirrors the offline extraction
 * path). It states ONLY classification-derived facts — band, value, the derived
 * printed range — and NEVER paraphrases or emits the MedlinePlus excerpt as
 * patient prose. Turning source text into patient-facing sentences is the live
 * model's job, behind the human review gate; a deterministic engine doing it
 * would be a second, ungated draft engine, which is exactly what this project's
 * architecture avoids. It reads as an obvious synthetic placeholder on purpose,
 * so no one mistakes it for real copy or "improves" it into that shadow engine.
 */
const BAND_PHRASE: Record<DraftInputRow['band'], string> = {
  in: 'within',
  below: 'below',
  above: 'above',
};

export function offlineDraft(input: DraftInputRow[]): DraftOutput {
  const inRange = input.filter((row) => row.band === 'in').length;
  // Every row can be excluded upstream (implausible, not covered, no printed
  // range), leaving nothing to summarize. Say that, rather than "0 of 0 results
  // within the typical range", which reads as a finding about the report.
  const summary =
    input.length === 0
      ? 'no results with a typical range to summarize.'
      : `${inRange} of ${input.length} results within the typical range.`;
  return {
    overallText:
      `Synthetic offline draft — ${summary} ` +
      'This placeholder states only classification facts; the grounded explanation is written by ' +
      'the drafting model. Discuss your results with your provider.',
    perTest: input.map((row) => ({
      analyteId: row.analyteId,
      text:
        `Synthetic offline draft: ${row.displayName} was ${row.rawValue}` +
        `${row.unit !== undefined ? ' ' + row.unit : ''}, ${BAND_PHRASE[row.band]} the typical ` +
        `range (${row.printedRange}). Discuss with your provider.`,
    })),
    // Sources are built in code by draftExplanation (verify-output.ts), not here.
    sources: [],
  };
}
