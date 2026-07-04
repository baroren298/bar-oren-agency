/*
 * Storage key generation — Gallery Upload Sprint 1
 * (GALLERY_UPLOAD_SPRINT_1_ARCHITECTURE.md §6). The stored object key is
 * ALWAYS random and collision-resistant, NEVER derived from or sanitized
 * from the user's original filename. This sidesteps an entire class of
 * path-traversal / special-character / encoding bypass bugs that
 * "sanitize the filename and use it as the key" approaches have to keep
 * re-solving — the random key can never contain "..", a path separator
 * from user input, or anything else attacker-controlled. The *original*
 * filename is still preserved for display/audit (Asset.originalFilename),
 * just never used as or folded into the key.
 */

import crypto from 'crypto';

const EXTENSION_BY_MIME_TYPE = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
});

/**
 * @param {object} params
 * @param {string} params.purpose - validated purpose string (validationProfiles.js),
 *   used only as a folder prefix for human-navigable storage, never trusted
 *   as anything more than that.
 * @param {string} [params.mimeType] - sniffed mime type (mimeSniff.js), used only to
 *   pick a file extension; falls back to a generic extension if unknown.
 * @returns {string} a key like "gallery/3f9c2e7a-....jpg" — safe to use as
 *   a storage path/object key on every provider in lib/storage/providers/.
 */
export function generateStorageKey({ purpose, mimeType } = {}) {
  if (!purpose || typeof purpose !== 'string') {
    throw new Error('[keyGen.generateStorageKey] purpose is required.');
  }
  // Defensive: purpose always comes from a fixed, validated set
  // (validationProfiles.js), but never let an unexpected value escape into
  // a path segment containing "/" or "..".
  if (/[\\/]|\.\./.test(purpose)) {
    throw new Error(`[keyGen.generateStorageKey] invalid purpose "${purpose}".`);
  }

  const id = crypto.randomUUID();
  const extension = EXTENSION_BY_MIME_TYPE[mimeType] || 'bin';

  return `${purpose}/${id}.${extension}`;
}

export default { generateStorageKey };
