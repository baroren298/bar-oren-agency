/*
 * Vercel Blob StorageProvider — Production Upload Enablement sprint.
 *
 * First cloud provider behind the abstraction localProvider.js established
 * (GALLERY_UPLOAD_SPRINT_1_ARCHITECTURE.md §2): implements the same
 * put / delete / getSignedUrl contract (lib/storage/types/StorageProvider.js)
 * against Vercel Blob via @vercel/blob. Selected by setting
 * STORAGE_PROVIDER=vercel-blob (lib/storage/index.js); nothing selects it by
 * default, so local development keeps using localProvider unchanged.
 *
 * Auth: the SDK reads BLOB_READ_WRITE_TOKEN from process.env itself (it is
 * injected automatically when a Blob store is attached to the Vercel
 * project). This module deliberately never reads or handles the token.
 *
 * Key semantics — deliberately different from localProvider: the `key`
 * returned from put() (and therefore stored as Asset.providerKey, and later
 * handed back to delete()/getSignedUrl()) is the FULL blob URL, not the
 * keyGen pathname passed in. That is exactly what Asset.providerKey is for
 * (schema comment: "that provider's own identifier for the file") — Vercel
 * Blob's management API (del/head) is addressed by blob URL, and the URL is
 * the only identifier the SDK guarantees can manage the file later. The
 * keyGen pathname is still what names the object inside the store
 * (addRandomSuffix: false — keyGen's random UUID already guarantees
 * uniqueness and safety, no second suffix needed).
 *
 * Blobs are public for now: gallery/profile images are public website
 * content the moment they're published, and the admin preview surface is
 * behind its own auth. getSignedUrl therefore returns the public URL
 * unchanged, same as localProvider's "no private-bucket concept" note.
 *
 * NOTE (known platform limit, accepted this sprint): server uploads through
 * a Vercel-hosted route handler are capped at ~4.5MB of request body by the
 * platform itself, below the 8MB cap in validationProfiles.js. Files between
 * 4.5MB and 8MB will be rejected by Vercel before reaching the route.
 * Client uploads (browser -> Blob directly) lift this but are a different
 * architecture — out of scope here, documented for the future.
 */

import { put as blobPut, del as blobDel } from '@vercel/blob';

/**
 * @param {Buffer} buffer
 * @param {{ key: string, mimeType?: string }} options - key comes from
 *   lib/storage/utils/keyGen.js (random, collision-resistant); mimeType is
 *   the server-sniffed type (lib/storage/utils/mimeSniff.js), forwarded so
 *   the blob is served with the correct Content-Type.
 * @returns {Promise<{ url: string, key: string, bytes: number }>}
 */
async function put(buffer, { key, mimeType } = {}) {
  if (!key || typeof key !== 'string') {
    throw new Error('[vercelBlobProvider.put] key is required.');
  }

  const result = await blobPut(key, buffer, {
    access: 'public',
    contentType: mimeType || undefined,
    // keyGen's UUID already guarantees a unique, attacker-uncontrollable
    // name — a second random suffix would only obscure the purpose/uuid.ext
    // convention shared with localProvider.
    addRandomSuffix: false,
  });

  return {
    url: result.url,
    // Provider management key IS the blob URL — see header comment.
    key: result.url,
    bytes: buffer.length,
  };
}

/**
 * Idempotent, matching localProvider.delete: Vercel Blob's del() succeeds
 * (does not throw) when the blob does not exist, which is exactly the
 * behavior assetService's compensating delete relies on.
 *
 * @param {string} key - the blob URL returned by put()
 * @returns {Promise<void>}
 */
async function del(key) {
  if (!key || typeof key !== 'string') {
    throw new Error('[vercelBlobProvider.delete] key is required.');
  }
  await blobDel(key);
}

/**
 * Public blobs — the public URL doubles as the "signed" URL, same shape as
 * localProvider.getSignedUrl.
 *
 * @param {string} key - the blob URL returned by put()
 * @returns {Promise<string>}
 */
async function getSignedUrl(key) {
  if (!key || typeof key !== 'string') {
    throw new Error('[vercelBlobProvider.getSignedUrl] key is required.');
  }
  return key;
}

export const vercelBlobProvider = {
  name: 'vercel-blob',
  put,
  delete: del,
  getSignedUrl,
};

export default vercelBlobProvider;
