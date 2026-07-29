/** Every PDF begins with the version header "%PDF-" (ISO 32000-1, §7.5.2). */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

/**
 * Whether the uploaded bytes are actually a PDF. The browser-reported MIME type
 * cannot decide this: it is client-supplied, and a dragged PDF often arrives with
 * an empty or generic binary type, so trusting it both rejects real reports and
 * accepts anything a caller cares to label. The leading bytes are the file's own
 * claim about itself, which is the closest thing to a fact available here without
 * a PDF parser.
 */
export function isPdfBytes(bytes: Uint8Array): boolean {
  return PDF_MAGIC.every((byte, index) => bytes[index] === byte);
}
