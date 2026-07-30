import { describe, expect, it } from 'vitest';
import { axisBounds } from './range-axis';

describe('axisBounds', () => {
  it('does not label an axis end below zero for a range that cannot go negative', () => {
    // ALT 9-46 padded by 0.6 of the span lands at -13.2 without the floor.
    expect(axisBounds(45, 9, 46).min).toBe(0);
    // Total bilirubin 0.2-1.2 lands at -0.4 without it.
    expect(axisBounds(0.7, 0.2, 1.2).min).toBe(0);
  });

  it('still pads below the low bound when there is room above zero', () => {
    const { min } = axisBounds(120, 100, 110);
    expect(min).toBeGreaterThan(0);
    expect(min).toBeLessThan(100);
  });

  it('keeps a negative axis when the range itself goes negative', () => {
    expect(axisBounds(-5, -10, 10).min).toBeLessThan(0);
  });

  it('widens the scale to keep a value far outside the range on it', () => {
    expect(axisBounds(15000, 65, 99).max).toBeGreaterThanOrEqual(15000);
  });

  it('handles one-sided ranges', () => {
    expect(axisBounds(175, undefined, 199).min).toBe(0);
    expect(axisBounds(62, 40, undefined).min).toBeGreaterThanOrEqual(0);
  });
});
