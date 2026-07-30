/**
 * Where the ends of a result's scale sit: the typical range plus breathing room, widened
 * when the value falls outside it so the marker stays on the scale. Pure presentation
 * math — it decides nothing about the result itself.
 */
export function axisBounds(
  value: number,
  low?: number,
  high?: number,
): { min: number; max: number } {
  let min = Math.min(value, low ?? value, high ?? value);
  let max = Math.max(value, low ?? value, high ?? value);

  if (low !== undefined && high !== undefined) {
    const pad = (high - low) * 0.6 || Math.abs(high) * 0.2 || 1;
    min = Math.min(min, low - pad);
    // Padding an ALT range of 9-46 lands at -13.2, and no value we report can be
    // negative, so don't label an axis end below zero.
    if (min < 0 && low >= 0) min = 0;
    max = Math.max(max, high + pad);
  } else if (high !== undefined) {
    min = Math.min(min, 0);
    max = Math.max(max, high * 1.6);
  } else if (low !== undefined) {
    min = Math.min(min, low * 0.5);
    max = Math.max(max, low * 1.8);
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const spread = max - min;
  if (value < min) min = value - spread * 0.1;
  if (value > max) max = value + spread * 0.1;

  return { min, max };
}
