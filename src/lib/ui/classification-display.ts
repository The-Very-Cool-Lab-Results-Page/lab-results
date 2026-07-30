import type { Classification } from '@/lib/types';

/**
 * Maps a classification to the label and visual tone the UI shows. These are
 * status labels, not medical content: the explanatory text always comes from
 * the approved Explanation, never from here. Bound to the shared Classification
 * shape in src/lib/types.
 */

export type Tone = 'in' | 'high' | 'low' | 'critical' | 'neutral';

export interface ClassificationDisplay {
  label: string;
  tone: Tone;
  /** Whether a range marker can be drawn (only for values placed on a scale). */
  showMarker: boolean;
}

/**
 * The same mapping for a row that has no classification yet. A missing classification is
 * shown as unreadable rather than as anything reassuring — the one honest default.
 */
export function rowClassificationDisplay(
  classification: Classification | undefined,
): ClassificationDisplay {
  return classificationDisplay(classification ?? { kind: 'unclassifiable', reason: 'no-range' });
}

export function classificationDisplay(classification: Classification): ClassificationDisplay {
  switch (classification.kind) {
    case 'range':
      if (classification.critical) {
        return { label: 'Needs prompt attention', tone: 'critical', showMarker: true };
      }
      if (classification.band === 'in') {
        return { label: 'In range', tone: 'in', showMarker: true };
      }
      if (classification.band === 'below') {
        return { label: 'A little low', tone: 'low', showMarker: true };
      }
      return { label: 'A little high', tone: 'high', showMarker: true };
    case 'implausible':
      return { label: 'Please double-check', tone: 'neutral', showMarker: false };
    case 'not-covered':
      return { label: 'Not covered yet', tone: 'neutral', showMarker: false };
    case 'unclassifiable':
      return { label: 'Could not be read', tone: 'neutral', showMarker: false };
  }
}
