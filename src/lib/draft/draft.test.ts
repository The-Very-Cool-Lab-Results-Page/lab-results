import { describe, expect, it } from 'vitest';
import type { ResultRow } from '@/lib/types';
import { getGrounding } from '@/lib/draft/medlineplus';
import { assertNoCriticalRows, buildDraftInput, derivePrintedRange } from './build-input';
import { assembleDraft, assertPerTestMatches, buildSources } from './verify-output';
import { offlineDraft } from './offline';
import type { DraftInputRow, DraftOutput } from './schema';

/**
 * Guards the drafting pipeline's mechanical safety properties — the parts that
 * do NOT depend on the model: which rows are drafted, the held-critical refusal,
 * the perTest 1:1 check, code-built sources, and the offline draft never emitting
 * source prose. These import the pure submodules directly (not ./index) so the
 * vendor boundary's `server-only` guard never loads, matching extract.test.ts.
 * The full offline path is exercised end to end by tests/e2e/full-loop.spec.ts;
 * the prose faithfulness of a live draft is not machine-checkable (it stays with
 * the prompt + human review), so it is not tested here.
 */

function row(over: Partial<ResultRow> & Pick<ResultRow, 'classification'>): ResultRow {
  return {
    id: 'r',
    reportId: 'rpt',
    rawName: 'Potassium',
    analyteId: 'potassium',
    value: '4.1',
    unit: 'mmol/L',
    labFlags: [],
    lowConfidenceFields: [],
    ...over,
  };
}

describe('buildDraftInput', () => {
  it('keeps only range rows and drops implausible/not-covered/unclassifiable', () => {
    const rows: ResultRow[] = [
      row({
        analyteId: 'potassium',
        classification: { kind: 'range', band: 'in', critical: false },
      }),
      row({ analyteId: 'glucose', classification: { kind: 'implausible' } }),
      row({ analyteId: undefined, rawName: 'Iron', classification: { kind: 'not-covered' } }),
      row({ classification: { kind: 'unclassifiable', reason: 'no-range' } }),
    ];
    expect(buildDraftInput(rows).map((r) => r.analyteId)).toEqual(['potassium']);
  });

  it('maps dictionary + grounding onto the row (title/url/excerpt from the cache)', () => {
    const [input] = buildDraftInput([
      row({
        analyteId: 'potassium',
        classification: { kind: 'range', band: 'above', critical: false },
      }),
    ]);
    const grounding = getGrounding('potassium');
    expect(input.displayName).toBeTruthy();
    expect(input.band).toBe('above');
    expect(input.medlineplusUrl).toBe(grounding?.url);
    expect(input.medlineplusTitle).toBe(grounding?.title);
    expect(input.medlineplusExcerpt).toBe(grounding?.excerpt);
  });

  it('derives one- and two-sided printed ranges without emitting a bare bound', () => {
    expect(
      derivePrintedRange(
        row({
          refLow: 3.5,
          refHigh: 5.1,
          classification: { kind: 'range', band: 'in', critical: false },
        }),
      ),
    ).toBe('3.5–5.1');
    expect(
      derivePrintedRange(
        row({ refHigh: 200, classification: { kind: 'range', band: 'in', critical: false } }),
      ),
    ).toBe('under 200');
    expect(
      derivePrintedRange(
        row({ refLow: 40, classification: { kind: 'range', band: 'in', critical: false } }),
      ),
    ).toBe('over 40');
    expect(
      derivePrintedRange(
        row({
          rawRange: '70 - 99',
          refHigh: 99,
          classification: { kind: 'range', band: 'in', critical: false },
        }),
      ),
    ).toBe('70 - 99');
  });
});

describe('assertPerTestMatches', () => {
  const input: DraftInputRow[] = [
    {
      analyteId: 'potassium',
      displayName: 'Potassium',
      rawValue: '4',
      printedRange: '3.5–5.1',
      band: 'in',
      critical: false,
    },
    {
      analyteId: 'sodium',
      displayName: 'Sodium',
      rawValue: '140',
      printedRange: '135–145',
      band: 'in',
      critical: false,
    },
  ];
  const out = (ids: string[]): DraftOutput => ({
    overallText: 'x',
    perTest: ids.map((analyteId) => ({ analyteId, text: 't' })),
    sources: [],
  });

  it('passes when perTest is exactly 1:1 with the input', () => {
    expect(() => assertPerTestMatches(input, out(['potassium', 'sodium']))).not.toThrow();
  });
  it('throws on a missing, extra, or duplicated test', () => {
    expect(() => assertPerTestMatches(input, out(['potassium']))).toThrow();
    expect(() => assertPerTestMatches(input, out(['potassium', 'sodium', 'glucose']))).toThrow();
    expect(() => assertPerTestMatches(input, out(['potassium', 'potassium']))).toThrow();
  });
});

describe('buildSources', () => {
  it('emits one verbatim source per row that has grounding, skips rows without', () => {
    const input: DraftInputRow[] = [
      {
        analyteId: 'potassium',
        displayName: 'Potassium',
        rawValue: '4',
        printedRange: '3.5–5.1',
        band: 'in',
        critical: false,
        medlineplusTitle: 'T',
        medlineplusUrl: 'https://medlineplus.gov/lab-tests/potassium-blood-test/',
      },
      {
        analyteId: 'mystery',
        displayName: 'Mystery',
        rawValue: '1',
        printedRange: '0–2',
        band: 'in',
        critical: false,
      },
    ];
    expect(buildSources(input)).toEqual([
      {
        analyteId: 'potassium',
        title: 'T',
        url: 'https://medlineplus.gov/lab-tests/potassium-blood-test/',
      },
    ]);
  });
});

describe('offlineDraft', () => {
  it('states classification facts and never emits the grounding excerpt as prose', () => {
    const excerpt = getGrounding('potassium')?.excerpt ?? '';
    const input = buildDraftInput([
      row({
        analyteId: 'potassium',
        classification: { kind: 'range', band: 'above', critical: false },
      }),
    ]);
    const draft = offlineDraft(input);
    expect(draft.perTest[0].analyteId).toBe('potassium');
    expect(draft.perTest[0].text).toContain('above');
    // The excerpt is source material — it must never appear verbatim in offline prose.
    expect(excerpt.length).toBeGreaterThan(0);
    expect(draft.perTest[0].text.includes(excerpt)).toBe(false);
    expect(draft.overallText.includes(excerpt)).toBe(false);
  });

  it('says there is nothing to summarize when every row was excluded', () => {
    // Implausible and not-covered rows are dropped by buildDraftInput, so a
    // report can reach drafting with no range rows at all.
    const input = buildDraftInput([
      row({ analyteId: 'glucose', classification: { kind: 'implausible' } }),
      row({ analyteId: undefined, rawName: 'Iron', classification: { kind: 'not-covered' } }),
    ]);
    expect(input).toHaveLength(0);
    const draft = offlineDraft(input);
    expect(draft.overallText).toContain('no results with a typical range');
    expect(draft.overallText).not.toContain('0 of 0');
    expect(draft.perTest).toHaveLength(0);
  });
});

describe('assertNoCriticalRows (whole-report hold, FR-07)', () => {
  it('throws when any row is critical', () => {
    const rows: ResultRow[] = [
      row({
        analyteId: 'potassium',
        classification: { kind: 'range', band: 'in', critical: false },
      }),
      row({
        analyteId: 'sodium',
        rawName: 'Sodium',
        classification: { kind: 'range', band: 'above', critical: true },
      }),
    ];
    expect(() => assertNoCriticalRows(rows)).toThrow(/critical/i);
  });
  it('passes when no row is critical', () => {
    const rows: ResultRow[] = [
      row({
        analyteId: 'potassium',
        classification: { kind: 'range', band: 'in', critical: false },
      }),
    ];
    expect(() => assertNoCriticalRows(rows)).not.toThrow();
  });
});

describe('assembleDraft (the offline pipeline end to end, sans vendor boundary)', () => {
  it('produces a 1:1 draft with code-built sources from an offline output', () => {
    const input = buildDraftInput([
      row({
        analyteId: 'potassium',
        classification: { kind: 'range', band: 'in', critical: false },
      }),
      row({ analyteId: undefined, rawName: 'Iron', classification: { kind: 'not-covered' } }),
    ]);
    const draft = assembleDraft(input, offlineDraft(input));
    expect(draft.perTest.map((p) => p.analyteId)).toEqual(['potassium']);
    expect(draft.sources.map((s) => s.analyteId)).toEqual(['potassium']);
    expect(draft.sources[0].url).toBe(getGrounding('potassium')?.url);
  });
});
