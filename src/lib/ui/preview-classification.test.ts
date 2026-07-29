import { describe, expect, it } from 'vitest';
import { previewClassification } from './preview-classification';
import { matchAnalyte } from '@/lib/analytes';
import { classifyRow } from '@/lib/classify';

/**
 * The preview must be the pipeline's own classification, not a parallel
 * implementation: what the provider sees on the verify screen is exactly what
 * confirmVerificationAction will stamp (FR-05/FR-06).
 */
describe('previewClassification', () => {
  it('classifies a matched analyte against the printed range', () => {
    const preview = previewClassification({
      rawName: 'Glucose',
      value: '92',
      unit: 'mg/dL',
      refLow: 70,
      refHigh: 99,
      labFlags: [],
    });
    expect(preview).toEqual({ kind: 'range', band: 'in', critical: false });
  });

  it('previews an extracted row that is not yet matched, from its raw name alone', () => {
    // Extraction stores rows with no analyte match (FR-03); the preview must
    // still recognize the printed name instead of showing "not covered".
    const preview = previewClassification({
      rawName: 'K+',
      value: '5.9',
      unit: 'mmol/L',
      refLow: 3.5,
      refHigh: 5.2,
      labFlags: [],
    });
    expect(preview).toEqual({ kind: 'range', band: 'above', critical: false });
  });

  it('shows critical when a curated threshold is crossed', () => {
    const preview = previewClassification({
      rawName: 'Potassium',
      value: '6.8',
      unit: 'mmol/L',
      refLow: 3.5,
      refHigh: 5.2,
      labFlags: [],
    });
    expect(preview).toEqual({ kind: 'range', band: 'above', critical: true });
  });

  it('reports an unknown test as not covered', () => {
    const preview = previewClassification({
      rawName: 'Reticulocyte count',
      value: '1.2',
      unit: '%',
      refLow: 0.5,
      refHigh: 2.5,
      labFlags: [],
    });
    expect(preview).toEqual({ kind: 'not-covered' });
  });

  it('maps a blank unit to "no unit", matching the confirm action', () => {
    // A blank unit must skip the curated-threshold check (FR-07), exactly as
    // the server does when it stamps the row.
    const preview = previewClassification({
      rawName: 'Potassium',
      value: '6.8',
      unit: '   ',
      refLow: 3.5,
      refHigh: 5.2,
      labFlags: [],
    });
    expect(preview).toEqual(
      classifyRow({
        value: '6.8',
        unit: undefined,
        refLow: 3.5,
        refHigh: 5.2,
        labFlags: [],
        analyte: matchAnalyte('Potassium'),
      }),
    );
    expect(preview).toEqual({ kind: 'range', band: 'above', critical: false });
  });
});
