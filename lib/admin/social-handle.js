/*
 * Shared social-handle normalization helper — Talent Visibility sprint,
 * Issue 2 fix (Admin Talent List social preview cleanup).
 *
 * Extracted from components/admin/SocialLinkRow.jsx, which already had this
 * exact normalization (stripLeadingAt/normalizeHandleDisplay) for the
 * talent workspace's Socials tab, but kept it as two unexported local
 * functions — so the Admin Talent List's preview
 * (lib/admin/talent-workspace.js's deriveListSocialPreview) had no shared
 * place to reuse it and rendered a stored handle as-is. That's why a handle
 * stored with a doubled leading "@" (e.g. "@@kimchourilov") showed up
 * unnormalized in the list, while the same handle already displayed
 * correctly ("@kimchourilov") in the workspace's Socials tab.
 *
 * Display-only: nothing here reads from or writes to the database, and
 * neither function mutates the value it's given — they only compute what to
 * *render*. SocialLinkRow.jsx now imports these instead of defining its own
 * copy, so there is exactly one implementation of "what does a clean handle
 * look like" for the whole admin UI.
 */

/**
 * Strips every leading "@" off a handle, e.g. "@@almavay" -> "almavay",
 * "@almavay" -> "almavay", "almavay" -> "almavay". The one normalization
 * primitive everything below builds on.
 *
 * @param {string|null|undefined} handle
 * @returns {string|null|undefined}
 */
export function stripLeadingAt(handle) {
  if (!handle) return handle;
  return handle.replace(/^@+/, '');
}

/**
 * Read-only / preview display form — always exactly one leading "@", no
 * matter how the value happens to be stored ("almavay", "@almavay", or a
 * defensively-handled "@@almavay" all become "@almavay"). Display-only: the
 * stored handle itself is never modified.
 *
 * @param {string|null|undefined} handle
 * @returns {string|null|undefined}
 */
export function normalizeHandleDisplay(handle) {
  if (!handle) return handle;
  return `@${stripLeadingAt(handle)}`;
}
