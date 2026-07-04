/*
 * StorageProvider contract — Gallery Upload Sprint 1
 * (GALLERY_UPLOAD_SPRINT_1_ARCHITECTURE.md §2). Deliberately narrow: three
 * methods, mirroring how lib/admin/engine/adapters/adapterContract.js keeps
 * its own required-method list tight rather than speculative. Excluded on
 * purpose: transformation/resizing (next.config.mjs's
 * `images.formats` + Next.js Image Optimization already own that),
 * listing/search (every lookup goes through the `Asset` table, never the
 * provider's own index), and access-control primitives beyond a signed URL
 * (this is an admin-only upload surface).
 *
 * This is documentation plus a runtime assertion helper, not a base
 * class — same pattern adapterContract.js uses for the engine's adapters,
 * for the same reason: a new provider only has to match this shape, never
 * import storage internals.
 */

export const REQUIRED_STORAGE_METHODS = Object.freeze(['put', 'delete', 'getSignedUrl']);

/**
 * Throws a descriptive error if `provider` does not satisfy the
 * StorageProvider contract.
 *
 * @param {object} provider
 * @returns {true}
 */
export function assertImplementsStorageContract(provider) {
  if (!provider || typeof provider !== 'object') {
    throw new Error('[StorageProvider] provider must be an object.');
  }

  if (!provider.name || typeof provider.name !== 'string') {
    throw new Error('[StorageProvider] provider is missing a static string "name".');
  }

  const missingMethods = REQUIRED_STORAGE_METHODS.filter(
    (methodName) => typeof provider[methodName] !== 'function'
  );
  if (missingMethods.length > 0) {
    throw new Error(
      `[StorageProvider] provider "${provider.name}" is missing required ` +
        `method(s): ${missingMethods.join(', ')}.`
    );
  }

  return true;
}

export default { REQUIRED_STORAGE_METHODS, assertImplementsStorageContract };

/*
 * Shape reference (not enforced by the runtime checker above beyond
 * presence — JS has no static typing here):
 *
 * StorageProvider {
 *   name: string
 *
 *   async put(buffer, { key, mimeType, purpose }) -> { url, key, bytes }
 *
 *   async delete(key) -> void
 *     // idempotent: deleting an already-missing key is not an error
 *
 *   async getSignedUrl(key, { expiresInSeconds } = {}) -> string
 *     // providers with no private-bucket concept (local, public-read
 *     // buckets) may simply return the public url unchanged
 * }
 */
