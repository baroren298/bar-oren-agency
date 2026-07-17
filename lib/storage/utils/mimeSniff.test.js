/*
 * mimeSniff — Production Upload Enablement sprint. Locks the byte-signature
 * behavior the whole upload security model leans on: the sniffed type (not
 * the client-declared one) is what validationProfiles allowlists are
 * checked against.
 */
import { describe, it, expect } from 'vitest';
import { sniffMimeType } from './mimeSniff';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const GIF = Buffer.from('GIF89a', 'ascii');
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]), // RIFF chunk size — value irrelevant to the sniffer
  Buffer.from('WEBPVP8 ', 'ascii'),
]);

describe('sniffMimeType', () => {
  it('detects JPEG by magic bytes', () => {
    expect(sniffMimeType(JPEG)).toBe('image/jpeg');
  });

  it('detects PNG by magic bytes', () => {
    expect(sniffMimeType(PNG)).toBe('image/png');
  });

  it('detects GIF by magic bytes', () => {
    expect(sniffMimeType(GIF)).toBe('image/gif');
  });

  it('detects WEBP via its RIFF container layout', () => {
    expect(sniffMimeType(WEBP)).toBe('image/webp');
  });

  it('returns null for content that matches no known signature (e.g. a renamed text file)', () => {
    expect(sniffMimeType(Buffer.from('<script>alert(1)</script>'))).toBe(null);
  });

  it('returns null for a RIFF file that is not WEBP (e.g. WAV)', () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from('WAVEfmt ', 'ascii'),
    ]);
    expect(sniffMimeType(wav)).toBe(null);
  });

  it('returns null for empty, null, or too-short input', () => {
    expect(sniffMimeType(Buffer.alloc(0))).toBe(null);
    expect(sniffMimeType(null)).toBe(null);
    expect(sniffMimeType(Buffer.from([0xff, 0xd8]))).toBe(null); // 2 bytes < shortest signature
  });
});
