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
  // mimeSniff.js can verify by byte signature).
  //
  // Profile Image Upload Fix sprint (2026-08-25) — lowered from 8MB to 4MB.
  // Production evidence: a 12.8MB profile photo failed with
  // FUNCTION_PAYLOAD_TOO_LARGE / "Request Entity Too Large" — the
  // deployment platform (Vercel) caps a route handler's request body at
  // ~4.5MB (see lib/storage/providers/vercelBlobProvider.js's header
  // comment), well below the old 8MB application limit, so oversized
  // profile uploads were rejected by the platform before this route ever
  // ran. 4MB leaves headroom under that ~4.5MB boundary (multipart framing
  // + the `purpose` field also count against it) while still fitting any
  // reasonably-sized portrait photo. Scoped to `profile` only — gallery and
  // podcast keep their existing 8MB cap and their own latent exposure to
  // the same platform limit, tracked separately, not part of this sprint.
  profile: Object.freeze({
    allowedMimeTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
    maxBytes: 4 * 1024 * 1024,
  }),
  // Podcast Image Upload sprint — podcast cover replacement in the admin
  // Podcast tab (PodcastTab.jsx), routed through the same shared
  // /api/admin/assets/upload endpoint via purpose="podcast". Same mime
  // allowlist as gallery/profile (still the only mime types mimeSniff.js
  // can verify by byte signature — no SVG, deliberately), and the same 8MB
  // cap: a single podcast cover image has no legitimate reason to exceed
  // the existing standard either.
  podcast: Object.freeze({
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
