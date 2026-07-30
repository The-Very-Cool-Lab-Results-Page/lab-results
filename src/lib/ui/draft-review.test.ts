import { describe, expect, it } from 'vitest';
import type { ResultRow } from '@/lib/types';
import { draftedRowByAnalyte, rowsOutsideExplanation } from './draft-review';

function row(over: Partial<ResultRow> & Pick<ResultRow, 'id' | 'rawName'>): ResultRow {
  return {
    reportId: 'rpt-1',
    value: '1',
    labFlags: [],
    lowConfidenceFields: [],
    ...over,
  };
}

const inRange = { kind: 'range', band: 'in', critical: false } as const;

describe('rowsOutsideExplanation', () => {
  it('lists the rows the explanation does not cover', () => {
    const rows = [
      row({ id: 'r1', rawName: 'ALT', analyteId: 'alt', classification: inRange }),
      row({ id: 'r2', rawName: 'HEPATITIS B SURFACE AG', classification: { kind: 'not-covered' } }),
    ];
    expect(rowsOutsideExplanation(rows, [{ analyteId: 'alt' }]).map((r) => r.id)).toEqual(['r2']);
  });

  // The bug this function exists to prevent: an explained row must not suppress a different
  // row that happens to share its analyte id, or the implausible value reaches the patient
  // without ever appearing at the approval gate.
  it('still lists an implausible row whose analyte is explained by another row', () => {
    const rows = [
      row({
        id: 'implausible',
        rawName: 'GLUCOSE',
        value: '15000',
        analyteId: 'glucose',
        classification: { kind: 'implausible' },
      }),
      row({
        id: 'drafted',
        rawName: 'GLUCOSE, FASTING',
        value: '92',
        analyteId: 'glucose',
        classification: inRange,
      }),
    ];
    expect(rowsOutsideExplanation(rows, [{ analyteId: 'glucose' }]).map((r) => r.id)).toEqual([
      'implausible',
    ]);
  });

  it('lists every row when there is nothing explained', () => {
    const rows = [row({ id: 'r1', rawName: 'ALT', analyteId: 'alt', classification: inRange })];
    expect(rowsOutsideExplanation(rows, [])).toHaveLength(1);
  });

  it('keeps report order', () => {
    const rows = [
      row({ id: 'r1', rawName: 'A', classification: { kind: 'not-covered' } }),
      row({ id: 'r2', rawName: 'ALT', analyteId: 'alt', classification: inRange }),
      row({ id: 'r3', rawName: 'C', classification: { kind: 'not-covered' } }),
    ];
    expect(rowsOutsideExplanation(rows, [{ analyteId: 'alt' }]).map((r) => r.id)).toEqual([
      'r1',
      'r3',
    ]);
  });
});

describe('draftedRowByAnalyte', () => {
  it('pairs an explanation entry with the range row, not a same-analyte implausible row', () => {
    const rows = [
      row({
        id: 'drafted',
        rawName: 'GLUCOSE, FASTING',
        value: '92',
        analyteId: 'glucose',
        classification: inRange,
      }),
      row({
        id: 'implausible',
        rawName: 'GLUCOSE',
        value: '15000',
        analyteId: 'glucose',
        classification: { kind: 'implausible' },
      }),
    ];
    // Last-wins on a plain analyte-id map would return the 15000 row and show the drafted
    // text beside the wrong value.
    expect(draftedRowByAnalyte(rows).get('glucose')?.id).toBe('drafted');
  });

  it('leaves out rows with no analyte match', () => {
    const rows = [row({ id: 'r1', rawName: 'Unknown', classification: { kind: 'not-covered' } })];
    expect(draftedRowByAnalyte(rows).size).toBe(0);
  });
});
