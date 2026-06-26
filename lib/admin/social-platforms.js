/*
 * Social platform registry — Social Links Editor Foundation sprint.
 *
 * Single source of truth for "which social platforms does the admin know
 * about." SocialLinksEditor/SocialLinkRow are entity-agnostic (see their
 * own header comments) — they just render one row per entry in whatever
 * `platforms` array they're given. This file is what makes adding a new
 * platform later a one-line change instead of touching component code:
 * append `{ key, label, icon }` here and every caller that uses the
 * default export picks it up automatically.
 *
 * Today's only caller is the talent workspace's רשתות tab (Instagram,
 * TikTok, YouTube, Facebook, Website per that sprint's brief), but the
 * shape is deliberately generic — no talent-specific field, no required
 * value — so the same registry (or a different one, e.g. without
 * "Website") can back agency social links, contact info, footer links, or
 * brand pages later, per this sprint's "Future Ready" / "Reusable
 * Components" requirements.
 *
 * Each entry:
 *   - key   (string) — stable identifier, used as the field key and as
 *     React list keys. Never shown to the employee directly.
 *   - label (string) — Hebrew display name, sourced from he.social.platforms
 *     so all admin copy still lives in one place (lib/admin/i18n/he.js).
 *   - icon  (string) — a single emoji, matching the existing emoji-icon
 *     language already used for eyebrow headers (🌍 ✏️ 💡) rather than
 *     introducing an icon library/sprite sheet for a UI-only sprint.
 */

import { he } from './i18n/he';

export const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: he.social.platforms.instagram, icon: '📷' },
  { key: 'tiktok', label: he.social.platforms.tiktok, icon: '🎵' },
  { key: 'youtube', label: he.social.platforms.youtube, icon: '▶️' },
  { key: 'facebook', label: he.social.platforms.facebook, icon: '📘' },
  { key: 'website', label: he.social.platforms.website, icon: '🌐' },
];

export default SOCIAL_PLATFORMS;
