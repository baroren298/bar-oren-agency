/*
 * Social platform registry — Social Links Editor Foundation sprint.
 * Extended by the Socials Tab Multi-Account UI sprint (THREADS entry +
 * lookup helper + the account-label registry below).
 *
 * Single source of truth for "which social platforms does the admin know
 * about." SocialLinksEditor/SocialAccountCard are entity-agnostic (see
 * their own header comments) — they just render one row/card per entry in
 * whatever `platforms` array they're given. This file is what makes adding
 * a new platform later a one-line change instead of touching component
 * code: append `{ key, label, icon }` here and every caller that uses the
 * default export picks it up automatically.
 *
 * Today's only caller is the talent workspace's רשתות tab (Instagram,
 * TikTok, YouTube, Facebook, Website, and now Threads), but the shape is
 * deliberately generic — no talent-specific field, no required value — so
 * the same registry (or a different one, e.g. without "Website") can back
 * agency social links, contact info, footer links, or brand pages later,
 * per this sprint's "Future Ready" / "Reusable Components" requirements.
 *
 * Each entry:
 *   - key   (string) — stable identifier, used as the field key and as
 *     React list keys. Never shown to the employee directly. Deliberately
 *     the lowercased form of the matching `SocialPlatform` Prisma enum
 *     value (INSTAGRAM → 'instagram', THREADS → 'threads', …) — the same
 *     convention `deriveListSocialPreview` (lib/admin/talent-workspace.js)
 *     already relies on, so `getPlatformEntry` below can look a DB row up
 *     by its raw enum string without a separate translation table.
 *   - label (string) — Hebrew display name, sourced from he.social.platforms
 *     so all admin copy still lives in one place (lib/admin/i18n/he.js).
 *   - icon  (string) — a single emoji, matching the existing emoji-icon
 *     language already used for eyebrow headers (🌍 ✏️ 💡) rather than
 *     introducing an icon library/sprite sheet for a UI-only sprint.
 *
 * THREADS — Socials Tab Multi-Account UI sprint: added here because it was
 * already a real `SocialPlatform` enum value (schema review, "anticipated
 * as a near-term addition") with no UI slot. Purely additive — existing
 * keys/order unchanged, no Prisma migration involved.
 */

import { he } from './i18n/he';

export const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: he.social.platforms.instagram, icon: '📷' },
  { key: 'tiktok', label: he.social.platforms.tiktok, icon: '🎵' },
  { key: 'youtube', label: he.social.platforms.youtube, icon: '▶️' },
  { key: 'facebook', label: he.social.platforms.facebook, icon: '📘' },
  { key: 'website', label: he.social.platforms.website, icon: '🌐' },
  { key: 'threads', label: he.social.platforms.threads, icon: '🧵' },
];

/**
 * Look up a platform registry entry by its raw DB value (Prisma
 * `SocialPlatform` enum string, e.g. "INSTAGRAM") rather than the
 * registry's lowercase `key`. Centralizes the `.toLowerCase()` convention
 * `deriveListSocialPreview` already used inline, so the new account-card
 * components don't duplicate it.
 *
 * @param {string|null|undefined} dbPlatform
 * @returns {{ key: string, label: string, icon: string }|null}
 */
export function getPlatformEntry(dbPlatform) {
  if (!dbPlatform) return null;
  return SOCIAL_PLATFORMS.find((entry) => entry.key === dbPlatform.toLowerCase()) || null;
}

/**
 * Account-label registry — Socials Tab Multi-Account UI sprint. Mirrors the
 * Prisma `SocialAccountLabel` enum exactly (MAIN/SECONDARY/SPAM/BRAND/
 * PERSONAL/OTHER) so the label `<select>` in SocialAccountCard / the new
 * "add platform" form always offers exactly the values the schema accepts —
 * no UI value can ever drift from the enum, same anti-drift reasoning the
 * schema comment for `SocialAccountLabel` itself documents.
 *
 * `value` stays uppercase (not lowercased like platform keys) because that
 * already matches `TalentSocial.label`'s raw DB shape one-for-one — no
 * lookup/translation needed on the way in or out.
 */
export const SOCIAL_ACCOUNT_LABELS = [
  { value: 'MAIN', label: he.social.labels.MAIN },
  { value: 'SECONDARY', label: he.social.labels.SECONDARY },
  { value: 'SPAM', label: he.social.labels.SPAM },
  { value: 'BRAND', label: he.social.labels.BRAND },
  { value: 'PERSONAL', label: he.social.labels.PERSONAL },
  { value: 'OTHER', label: he.social.labels.OTHER },
];

export default SOCIAL_PLATFORMS;
