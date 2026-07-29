import { parseNumber } from '@/lib/classify/parse';

/** Which reference cell the text was typed into. */
export type BoundSide = 'low' | 'high';

/** A leading comparator as labs print one-sided ranges: "< 200", "> OR = 60", "≤ 5". */
const LEADING_COMPARATOR = /^([<>≤≥])=?\s*(?:or\s*=\s*)?/i;

/**
 * Labs print sub-1 bounds both ways — "0.70" and ".70" — but the classifier's
 * parseNumber requires the leading digit. Supply it rather than drop the bound;
 * this is notation, not inference: no digit of the printed number changes.
 */
function withLeadingZero(text: string): string {
  return text.replace(/^([+-]?)\./, (_match, sign: string) => `${sign}0.`);
}

/**
 * A reference bound as transcribed by extraction. Strict about comparators on
 * purpose: one here means the model put a one-sided range in a field the prompt
 * says holds a bare bound, and which bound it meant cannot be known — an empty
 * cell tells the provider to read it off the PDF, where a guess would look
 * answered while being wrong. `rawRange` keeps the printed text verbatim.
 */
export function parseExtractedBound(text: string | undefined): number | undefined {
  if (text === undefined) return undefined;
  return parseNumber(withLeadingZero(text.trim())) ?? undefined;
}

/**
 * A reference bound the provider typed on the verify screen. Extraction splits a
 * printed one-sided range into the single bound it states, but a provider
 * correcting that cell by hand types the comparator with it, and a bare
 * `Number()` drops the whole bound.
 *
 * A comparator that contradicts its column is dropped rather than reinterpreted:
 * "> 40" is a lower bound, so in *Ref high* it would store 40 as a ceiling and a
 * healthy HDL of 60 would be called above range. The two readings cannot both be
 * honoured and neither can be known to be the intended one, so the row falls back
 * to having no range — which the live preview shows immediately, next to the cell.
 *
 * Printed VALUES are never comparator-parsed on either path: "<5" means the true
 * value is unknown (classify/parse.ts).
 */
export function parseBoundInput(text: string | undefined, side: BoundSide): number | undefined {
  if (text === undefined) return undefined;
  const trimmed = text.trim();
  const comparator = LEADING_COMPARATOR.exec(trimmed);
  if (comparator !== null) {
    const readsAsLowerBound = comparator[1] === '>' || comparator[1] === '≥';
    if (readsAsLowerBound !== (side === 'low')) return undefined;
  }
  return parseExtractedBound(trimmed.replace(LEADING_COMPARATOR, ''));
}
