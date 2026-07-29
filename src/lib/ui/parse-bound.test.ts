import { describe, expect, it } from 'vitest';
import { parseBoundInput, parseExtractedBound } from './parse-bound';

describe('parseExtractedBound', () => {
  it('parses a transcribed bound, including the leading-decimal form labs print', () => {
    expect(parseExtractedBound('0.70')).toBe(0.7);
    expect(parseExtractedBound('.70')).toBe(0.7);
    expect(parseExtractedBound('-.5')).toBe(-0.5);
    expect(parseExtractedBound('1,200')).toBe(1200);
  });

  it('keeps no bound when the model put a comparator in a bare-bound field', () => {
    // Which bound "< 200" meant cannot be known from the field it landed in;
    // an empty cell asks the provider to read it off the PDF.
    expect(parseExtractedBound('< 200')).toBeUndefined();
    expect(parseExtractedBound('> 40')).toBeUndefined();
    expect(parseExtractedBound('')).toBeUndefined();
    expect(parseExtractedBound(undefined)).toBeUndefined();
  });
});

describe('parseBoundInput', () => {
  it('parses a plain printed bound in either cell', () => {
    expect(parseBoundInput('200', 'high')).toBe(200);
    expect(parseBoundInput(' 0.70 ', 'low')).toBe(0.7);
    expect(parseBoundInput('1,200', 'high')).toBe(1200);
    // Labs print sub-1 bounds with and without the leading zero.
    expect(parseBoundInput('.70', 'low')).toBe(0.7);
    expect(parseBoundInput('< .5', 'high')).toBe(0.5);
  });

  it('keeps a comparator bound that agrees with its cell', () => {
    expect(parseBoundInput('> 40', 'low')).toBe(40);
    expect(parseBoundInput('>= 40', 'low')).toBe(40);
    expect(parseBoundInput('> OR = 60', 'low')).toBe(60);
    expect(parseBoundInput('< 200', 'high')).toBe(200);
    expect(parseBoundInput('<200', 'high')).toBe(200);
    expect(parseBoundInput('≤ 5', 'high')).toBe(5);
    expect(parseBoundInput('≥ 5', 'low')).toBe(5);
  });

  it('drops a comparator that contradicts its cell rather than inverting the range', () => {
    // "> 40" in Ref high would cap the range at 40 and call a healthy 60 "above".
    expect(parseBoundInput('> 40', 'high')).toBeUndefined();
    expect(parseBoundInput('≥ 40', 'high')).toBeUndefined();
    expect(parseBoundInput('< 200', 'low')).toBeUndefined();
    expect(parseBoundInput('≤ 200', 'low')).toBeUndefined();
  });

  it('has no bound when the cell is empty or not a number', () => {
    expect(parseBoundInput('', 'low')).toBeUndefined();
    expect(parseBoundInput('   ', 'high')).toBeUndefined();
    expect(parseBoundInput(undefined, 'low')).toBeUndefined();
    expect(parseBoundInput('see report', 'high')).toBeUndefined();
    expect(parseBoundInput('<', 'high')).toBeUndefined();
    // Exponent notation is not something a lab prints; Number() would accept it.
    expect(parseBoundInput('1e3', 'high')).toBeUndefined();
  });
});
