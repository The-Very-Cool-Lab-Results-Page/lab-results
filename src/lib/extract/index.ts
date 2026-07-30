import { isLiveLLM } from '@/lib/llm';
import { offlineExtract } from './offline';
import type { ExtractionResult } from './schema';

/**
 * PDF -> structured rows (FR-03). Transcription only: no analyte match, no
 * classification, no medical knowledge — those happen after the provider
 * verifies (FR-05/FR-06). Uncertain fields are flagged, never filled;
 * unreadable input yields fewer/empty rows, never fabricated ones.
 *
 * Live when an API key AND the report's PDF bytes are both present; otherwise the
 * offline synthetic path keyed by the report's pdfRef. The live path is imported
 * dynamically so the offline path (and CI) never load the vendor SDK.
 */
export async function extractRows(input: {
  pdfRef: string;
  pdfBytes?: Uint8Array;
}): Promise<ExtractionResult> {
  if (isLiveLLM() && input.pdfBytes !== undefined) {
    const { liveExtract } = await import('./live');
    return liveExtract(input.pdfBytes);
  }
  return offlineExtract(input.pdfRef);
}

export { extractionSchema, extractedRowSchema } from './schema';
export type { ExtractionResult, ExtractedRow } from './schema';
export { availablePdfRefs } from './offline';
