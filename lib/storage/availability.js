/*
 * Upload availability check — Pre-merge blocker fix sprint (QA finding #1).
 *
 * The only storage provider that exists today is `local`
 * (lib/storage/providers/localProvider.js), which writes under
 * public/uploads/ and deliberately refuses to run when
 * NODE_ENV === 'production' (no durable shared filesystem on Vercel; the
 * directory is also gitignored, so anything written there would 404 in a
 * deployed build anyway). Until a cloud StorageProvider is configured via
 * STORAGE_PROVIDER, uploads are therefore only possible in local
 * development.
 *
 * This module makes that fact checkable *before* any byte is uploaded, so:
 *   - the upload API route can refuse early with a clear Hebrew message
 *     (503) instead of a generic 500 from localProvider's own throw, and
 *   - server components can pass an `uploadsEnabled` flag down to the
 *     upload UI, which then renders a disabled state instead of a button
 *     that can only fail.
 *
 * Server-side only: it reads process.env.STORAGE_PROVIDER, which is not
 * exposed to the client bundle — client components must receive the result
 * as a prop from a server component, never import this to compute it
 * themselves.
 *
 * Deliberately mirrors lib/storage/index.js's provider resolution
 * (process.env.STORAGE_PROVIDER || 'local') without importing the provider
 * itself — this is a pure predicate with no side effects and no provider
 * construction. When a real cloud provider is added to PROVIDERS in
 * lib/storage/index.js later, configuring STORAGE_PROVIDER to it makes
 * this return true in production automatically — no call site changes.
 */

/**
 * @returns {boolean} true when the active storage provider can accept
 *   uploads in the current environment.
 */
export function isUploadAvailable() {
  const providerName = process.env.STORAGE_PROVIDER || 'local';
  if (providerName === 'local' && process.env.NODE_ENV === 'production') {
    return false;
  }
  return true;
}

export default { isUploadAvailable };
