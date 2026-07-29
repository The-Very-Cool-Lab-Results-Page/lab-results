import { describe, expect, it } from 'vitest';
import { isPdfBytes } from './pdf-bytes';

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

describe('isPdfBytes', () => {
  it('accepts a file that starts with the PDF header', () => {
    expect(isPdfBytes(bytes('%PDF-1.7\n...'))).toBe(true);
  });

  it('rejects other content, whatever it is labelled', () => {
    expect(isPdfBytes(bytes('not a pdf'))).toBe(false);
    expect(isPdfBytes(bytes('<!doctype html>'))).toBe(false);
    expect(isPdfBytes(bytes('%PDF'))).toBe(false); // truncated header
    expect(isPdfBytes(new Uint8Array())).toBe(false);
  });
});
