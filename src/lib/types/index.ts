/**
 * Shared types — the contract all three tracks build against (SPEC.md §Data model).
 *
 * Two kinds of shapes live here:
 *
 * 1. Untrusted boundaries — zod schemas with types derived via z.infer. Per CLAUDE.md
 *    these are the three places outside data enters the system: the LLM's extraction
 *    output (ExtractedRow), uploaded-file metadata, and the patient's typed DOB.
 *    All are .strict(): unknown keys are rejected, not silently dropped.
 *
 * 2. Internal shapes — plain types produced and consumed by our own code.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Untrusted boundary 1: the LLM's extraction output (FR-03)
// ---------------------------------------------------------------------------

/**
 * One transcribed test row as returned by extraction. Transcription only: `value` and
 * `rawName` are exactly as printed on the PDF; fields the model can't read stay absent
 * and are named in `lowConfidenceFields`, never fabricated.
 */
export const extractedRowSchema = z
  .object({
    rawName: z.string().min(1),
    value: z.string(), // as printed — may be "Negative", ">90"; parsing is the classifier's job
    unit: z.string().optional(),
    refLow: z.number().optional(), // one-sided ranges allowed
    refHigh: z.number().optional(),
    rawRange: z.string().optional(), // the range exactly as printed
    labFlags: z.array(z.string()), // raw printed flags, e.g. ["H"] — never normalized here
    lowConfidenceFields: z.array(z.string()),
  })
  .strict();

export type ExtractedRow = z.infer<typeof extractedRowSchema>;

// ---------------------------------------------------------------------------
// Untrusted boundary 2: uploaded-file metadata (FR-02)
// ---------------------------------------------------------------------------

/** ~15 MB — proxy for FR-02's "~10 pages"; page count is checked later in upload logic. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * `mimeType` is client-supplied and browsers disagree: a dragged PDF often
 * arrives with an empty or generic binary type. It is therefore checked loosely
 * here, and whether the upload is really a PDF is decided by its leading bytes
 * (`isPdfBytes` in src/lib/extract/pdf-bytes.ts).
 */
export const uploadedFileMetaSchema = z
  .object({
    fileName: z.string().min(1),
    mimeType: z.union([
      z.literal('application/pdf'),
      z.literal('application/octet-stream'),
      z.literal(''),
    ]),
    sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  })
  .strict();

export type UploadedFileMeta = z.infer<typeof uploadedFileMetaSchema>;

// ---------------------------------------------------------------------------
// Untrusted boundary 3: the patient's typed DOB (share-link gate, FR-11)
// ---------------------------------------------------------------------------

/** ISO 8601 calendar date (YYYY-MM-DD); must be a real date and not in the future. */
export const dobSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, 'not a real calendar date')
  .refine((s) => s <= new Date().toISOString().slice(0, 10), 'must not be in the future');

export type Dob = z.infer<typeof dobSchema>;

// ---------------------------------------------------------------------------
// Internal shapes (plain types)
// ---------------------------------------------------------------------------

/**
 * FR-02 — the report's fixed life stages. `verified` and `approved` are the two human
 * safety gates; `held` is the terminal branch off `verified` for a critical result
 * (FR-07): report held, nothing drafted or sent.
 */
export type ReportStatus =
  'uploaded' | 'extracted' | 'verified' | 'held' | 'drafted' | 'approved' | 'sent';

/**
 * FR-06/07/08 — how a result gets labelled. Deterministic code decides this, never the AI.
 * The safe states are first-class cases so a screen physically cannot forget to handle them.
 */
export type Classification =
  | { kind: 'range'; band: 'below' | 'in' | 'above'; critical: boolean }
  | { kind: 'implausible' } // FR-08: never explained as real
  | { kind: 'not-covered' } // FR-04: unknown test, honest fallback
  | { kind: 'unclassifiable'; reason: 'non-numeric' | 'no-range' };

/** dob is an ISO date string; synthetic data only in v1 (FR-15). */
export type PatientInfo = { name: string; email: string; dob: string };

export type PerTestExplanation = { analyteId: string; text: string };

/** MedlinePlus link — doubles as the required attribution (FR-09). */
export type Source = { analyteId: string; title: string; url: string };

/**
 * The analyte dictionary — human-curated, cited. Critical/plausibility thresholds change
 * only with a human-provided cited source; they are expressed in `unit`.
 */
export type AnalyteEntry = {
  id: string; // stable lowercase slug ("hemoglobin") — never renamed once fixtures reference it
  loinc: string;
  displayName: string;
  aliases: string[];
  medlineplusUrl: string;
  unit: string;
  criticalLow?: number;
  criticalHigh?: number;
  plausibleLow?: number;
  plausibleHigh?: number;
};

export type Report = {
  id: string;
  patient: PatientInfo;
  pdfRef: string; // storage reference to the uploaded PDF
  status: ReportStatus;
  createdAt: string; // ISO timestamp
  updatedAt: string;
};

/**
 * One row per test on the report. Built from an ExtractedRow by adding ids, the analyte
 * match, and — only after the provider verifies (gate 1) — the classification.
 */
export type ResultRow = {
  id: string;
  reportId: string;
  rawName: string;
  analyteId?: string; // filled by normalization; absent = "not covered"
  value: string;
  unit?: string;
  refLow?: number;
  refHigh?: number;
  rawRange?: string;
  labFlags: string[];
  lowConfidenceFields: string[];
  classification?: Classification; // set only after provider verification (FR-05)
};

export type Explanation = {
  id: string;
  reportId: string;
  overallText: string; // the "Overall picture" synthesis
  perTest: PerTestExplanation[];
  sources: Source[];
  status: 'draft' | 'approved'; // approved text is stored and frozen (FR-10)
  approvedAt?: string;
};

export type ShareLink = {
  id: string;
  reportId: string;
  token: string; // unguessable; never written to logs (safety rule 5)
  expiresAt: string;
  openedAt?: string;
  supersededAt?: string; // set when a re-send replaces this expired link; the old URL then renders ExpiredNotice, never a 404 (FR-11)
};

export type OutreachMethod = 'phone' | 'other';

/**
 * A provider's record of directly contacting the patient about a critical result
 * (FR-07). Documentation only: it never notifies the patient and never lifts the
 * hold. The note is provider-entered and never written to logs (safety rule 5).
 */
export type OutreachEntry = {
  reportId: string;
  analyteId: string;
  method: OutreachMethod;
  note: string;
  at: string; // ISO timestamp
};
