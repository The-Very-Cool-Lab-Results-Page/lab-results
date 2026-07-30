import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateStructured } from '@/lib/llm';
import { extractionSchema, type ExtractionResult } from './schema';

/**
 * The live extraction path: transcribe a report PDF via the model, through the
 * single vendor boundary in src/lib/llm.ts. Reached only when an API key AND the
 * PDF bytes are both present (the caller checks), so nothing is ever guessed.
 *
 * Loaded dynamically by index.ts so the offline path never pulls in the vendor
 * SDK or `server-only`. Not covered by the offline tests or CI — validate on a
 * spike with a real key before any real use.
 *
 * The prompt is a content file (CLAUDE.md), read at call time. Its path is added
 * to next.config.ts `outputFileTracingIncludes` so it ships in the serverless
 * bundle on Vercel.
 */
const PROMPT_PATH = join(process.cwd(), 'src/lib/extract/extract-prompt.md');

export async function liveExtract(pdfBytes: Uint8Array): Promise<ExtractionResult> {
  const system = readFileSync(PROMPT_PATH, 'utf8');
  const result = await generateStructured({
    system,
    schema: extractionSchema,
    parts: [
      {
        type: 'text',
        text: 'Transcribe every test line from this lab report as structured rows. Add no medical knowledge.',
      },
      { type: 'file', data: pdfBytes, mediaType: 'application/pdf' },
    ],
  });
  // generateStructured already validates against the schema; re-parse so the live
  // and offline paths both return through the same untrusted-input gate (FR-03).
  return extractionSchema.parse(result);
}
