/*
 * StorageProvider resolver — Gallery Upload Sprint 1
 * (GALLERY_UPLOAD_SPRINT_1_ARCHITECTURE.md §2). Selects and caches a single
 * provider per process based on STORAGE_PROVIDER (a non-secret config flag,
 * read the same way lib/admin/security/rateLimit.js already reads
 * LOGIN_RATE_LIMIT_* — this is the running process reading its own env, not
 * inspecting .env file contents). Defaults to 'local' since that is the
 * only provider Sprint 1 wires up; adding a cloud provider later is adding
 * one more entry to PROVIDERS, not touching any caller of
 * getStorageProvider().
 */

import { assertImplementsStorageContract } from './types/StorageProvider.js';
import { localProvider } from './providers/localProvider.js';

const PROVIDERS = Object.freeze({
  local: localProvider,
});

let cachedProvider = null;

/**
 * @returns {import('./types/StorageProvider.js').default}
 */
export function getStorageProvider() {
  if (cachedProvider) return cachedProvider;

  const providerName = process.env.STORAGE_PROVIDER || 'local';
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new Error(
      `[storage] unknown STORAGE_PROVIDER "${providerName}". Known providers: ` +
        `${Object.keys(PROVIDERS).join(', ')}.`
    );
  }

  assertImplementsStorageContract(provider);
  cachedProvider = provider;
  return cachedProvider;
}

export default { getStorageProvider };
