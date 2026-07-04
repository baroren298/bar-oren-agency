/*
 * Local filesystem StorageProvider — Gallery Upload Sprint 1
 * (GALLERY_UPLOAD_SPRINT_1_ARCHITECTURE.md §2.3). Development-only: writes
 * under public/uploads/ so the dev server can serve the file back with no
 * extra route. Refuses to run in production, where there is no durable,
 * shared filesystem to write to (e.g. Vercel) — a real deployment must
 * configure a cloud StorageProvider (out of scope for this sprint) via
 * STORAGE_PROVIDER instead.
 *
 * Implements the contract documented in
 * lib/storage/types/StorageProvider.js: put / delete / getSignedUrl.
 */

import fs from 'fs/promises';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

function assertDevEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[localProvider] refusing to run in production — there is no durable ' +
        'shared filesystem to write to. Configure a cloud StorageProvider ' +
        'via STORAGE_PROVIDER instead.'
    );
  }
}

function resolveAbsolutePath(key) {
  // `key` is always produced by keyGen.generateStorageKey, which already
  // rejects path-traversal characters in `purpose` — this resolve+contain
  // check is a second, independent guard against any future caller that
  // doesn't go through keyGen.
  const absolute = path.join(UPLOADS_DIR, key);
  if (!absolute.startsWith(UPLOADS_DIR + path.sep)) {
    throw new Error(`[localProvider] rejected key outside uploads dir: "${key}"`);
  }
  return absolute;
}

/**
 * @param {Buffer} buffer
 * @param {{ key: string }} options
 * @returns {Promise<{ url: string, key: string, bytes: number }>}
 */
async function put(buffer, { key }) {
  assertDevEnvironment();
  if (!key || typeof key !== 'string') {
    throw new Error('[localProvider.put] key is required.');
  }

  const absolutePath = resolveAbsolutePath(key);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return {
    url: `/uploads/${key}`,
    key,
    bytes: buffer.length,
  };
}

/**
 * Idempotent: deleting an already-missing key is not an error (this is
 * also how the compensating delete in assetService stays safe to call even
 * if the DB write that should have triggered it never actually ran).
 *
 * @param {string} key
 * @returns {Promise<void>}
 */
async function del(key) {
  assertDevEnvironment();
  const absolutePath = resolveAbsolutePath(key);
  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

/**
 * No private-bucket concept locally — the public path doubles as the
 * "signed" url.
 *
 * @param {string} key
 * @returns {Promise<string>}
 */
async function getSignedUrl(key) {
  assertDevEnvironment();
  return `/uploads/${key}`;
}

export const localProvider = {
  name: 'local',
  put,
  delete: del,
  getSignedUrl,
};

export default localProvider;
