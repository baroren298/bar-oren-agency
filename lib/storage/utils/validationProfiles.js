/*
 * Per-purpose upload validation config — Gallery Upload Sprint 1
 * (GALLERY_UPLOAD_SPRINT_1_ARCHITECTURE.md §5/§6). One shared upload
 * endpoint branches its validation rules on a required `purpose` field by
 * looking it up here, rather than forking the endpoint per module — adding
 * a future purpose (profile, podcast, logo, document...) is a config
 * change to this file, not a new route or a new code path.
 *
 * `allowedMimeTypes` here must stay a subset of what
 * lib/storage/utils/mimeSniff.js actually knows how to verify by byte
 * signature — there is no point allowlisting a mime type this module can't
 * independently confirm against the real file bytes. Sprint 1 only needs
 * `gallery`; this file is intentionally easy to extend, not pre-populated
 * with purposes nothing calls yet.
 */

export const VALIDATION_PROFILES = Object.freeze({
  gallery: Object.freeze({
    allowedMimeTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
    maxBytes: 8 * 1024 * 1024, // 8MB — a gallery photo has no legitimate reason to be larger.
  }),
  // Create Talent Sprint 1 — profile photo uploads (NewTalentForm.jsx),
  // routed through the same shared /api/admin/assets/upload endpoint via
  // purpose="profile". Same mime allowlist as gallery (the only mime types
  // mimeSniff.js can verify by byte signature); a single portrait photo has
  // no legitimate reason to exceed a gallery photo's size cap either, so the
  // limit is left at the same 8MB rather than inventing a new number.
  profile: Object.freeze({
    allowedMimeTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
    maxBytes: 8 * 1024 * 1024,
  }),
});

/**
 * @param {string} purpose
 * @returns {{ allowedMimeTypes: string[], maxBytes: number }}
 */
export function getValidationProfile(purpose) {
  const profile = VALIDATION_PROFILES[purpose];
  if (!profile) {
    const error = new Error(
      `[validationProfiles] unknown purpose "${purpose}". Known purposes: ` +
        `${Object.keys(VALIDATION_PROFILES).join(', ')}.`
    );
    error.code = 'UNKNOWN_PURPOSE';
    throw error;
  }
  return profile;
}

export default { VALIDATION_PROFILES, getValidationProfile };
