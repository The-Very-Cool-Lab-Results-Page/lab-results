import { describe, expect, it } from 'vitest';

import { extractedRowSchema, uploadedFileMetaSchema, MAX_UPLOAD_BYTES } from './index';

const validRow = {
  rawName: 'Hemoglobin',
  value: '13.2',
  unit: 'g/dL',
  refLow: 12,
  refHigh: 16,
  rawRange: '12.0-16.0',
  labFlags: [],
  lowConfidenceFields: [],
};

describe('extractedRowSchema', () => {
  it('accepts a valid extracted row', () => {
    const parsed = extractedRowSchema.parse(validRow);
    expect(parsed).toEqual(validRow);
  });

  it('accepts a minimal row (one-sided/absent range, non-numeric value)', () => {
    const parsed = extractedRowSchema.parse({
      rawName: 'HIV Ag/Ab Screen',
      value: 'Negative',
      labFlags: [],
      lowConfidenceFields: ['unit'],
    });
    expect(parsed.value).toBe('Negative');
  });

  it('rejects a row without a rawName', () => {
    expect(extractedRowSchema.safeParse({ ...validRow, rawName: undefined }).success).toBe(false);
    expect(extractedRowSchema.safeParse({ ...validRow, rawName: '' }).success).toBe(false);
  });

  it('rejects a numeric value — transcription is a string, exactly as printed', () => {
    expect(extractedRowSchema.safeParse({ ...validRow, value: 13.2 }).success).toBe(false);
  });

  it('rejects unknown extra keys — the LLM output is untrusted', () => {
    expect(extractedRowSchema.safeParse({ ...validRow, diagnosis: 'anemia' }).success).toBe(false);
  });
});

describe('uploadedFileMetaSchema (FR-02)', () => {
  const validMeta = {
    fileName: 'report.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 240_000,
  };

  it('accepts a PDF within the size cap', () => {
    expect(uploadedFileMetaSchema.parse(validMeta)).toEqual(validMeta);
  });

  it('rejects a type that is positively something else', () => {
    expect(uploadedFileMetaSchema.safeParse({ ...validMeta, mimeType: 'text/plain' }).success).toBe(
      false,
    );
    expect(uploadedFileMetaSchema.safeParse({ ...validMeta, mimeType: 'image/png' }).success).toBe(
      false,
    );
  });

  it('tolerates the types browsers actually send for a dragged PDF', () => {
    // Content is decided by the leading bytes, not this field.
    expect(uploadedFileMetaSchema.safeParse({ ...validMeta, mimeType: '' }).success).toBe(true);
    expect(
      uploadedFileMetaSchema.safeParse({ ...validMeta, mimeType: 'application/octet-stream' })
        .success,
    ).toBe(true);
  });

  it('rejects an empty file and one past the size cap', () => {
    expect(uploadedFileMetaSchema.safeParse({ ...validMeta, sizeBytes: 0 }).success).toBe(false);
    expect(
      uploadedFileMetaSchema.safeParse({ ...validMeta, sizeBytes: MAX_UPLOAD_BYTES + 1 }).success,
    ).toBe(false);
  });
});
