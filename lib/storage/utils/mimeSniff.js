/*
 * Byte-signature ("magic number") mime detection — Gallery Upload Sprint 1
 * (GALLERY_UPLOAD_SPRINT_1_ARCHITECTURE.md §6). Never trust the client-
 * supplied Content-Type/File.type — sniff the actual bytes server-side.
 * Deliberately scoped to the image types Gallery Upload Sprint 1's
 * validation profile actually allows (validationProfiles.js); add a new
 * signature here in the same change that adds a new mime type to a
 * validation profile, never speculatively ahead of it.
 */

/** @type {Array<{ mimeType: string, signature: number[] }>} */
const FIXED_OFFSET_SIGNATURES = Object.freeze([
  { mimeType: 'image/jpeg', signature: [0xff, 0xd8, 0xff] },
  { mimeType: 'image/png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mimeType: 'image/gif', signature: [0x47, 0x49, 0x46, 0x38] },
]);

function matchesSignature(buffer, signature) {
  if (buffer.length < signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (buffer[i] !== signature[i]) return false;
  }
  return true;
}

/** WEBP is a RIFF container: bytes 0-3 "RIFF", bytes 8-11 "WEBP". */
function isWebp(buffer) {
  if (buffer.length < 12) return false;
  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');
  return riff === 'RIFF' && webp === 'WEBP';
}

/**
 * Inspect the first bytes of a file and return the mime type its actual
 * content matches, or null if none of the known signatures match.
 *
 * @param {Buffer} buffer
 * @returns {string|null}
 */
export function sniffMimeType(buffer) {
  if (!buffer || buffer.length === 0) return null;

  for (const { mimeType, signature } of FIXED_OFFSET_SIGNATURES) {
    if (matchesSignature(buffer, signature)) {
      return mimeType;
    }
  }

  if (isWebp(buffer)) {
    return 'image/webp';
  }

  return null;
}

export default { sniffMimeType };
