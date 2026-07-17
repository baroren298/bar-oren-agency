/*
 * SEO field registry — SEO Editor Foundation sprint, completed by the
 * Talent SEO + Slug Management sprint.
 *
 * Single source of truth for "which SEO fields does the admin know about,"
 * same role social-platforms.js plays for SocialLinksEditor. SeoEditor/
 * SeoFieldRow are entity-agnostic — they just render one group/row per
 * entry in whatever `groups` array they're given.
 *
 * Talent SEO + Slug Management sprint changes:
 *   - Field keys now MATCH the TalentVersion column names exactly
 *     (seoTitle, seoDescription, seoCanonicalUrl, seoOgTitle,
 *     seoOgDescription, seoOgImageUrl, seoNoindex), so the SEO editor's
 *     proposed-values object can be PATCHed straight to the existing
 *     proposals/[versionId] route with zero key translation — the same
 *     Draft → Submit → Approve → Publish path every other Talent field
 *     already rides.
 *   - `keywords` is removed: the completed SEO model (this sprint's
 *     product spec) has no keywords field and no column backs it — a field
 *     that silently persists nowhere would be dishonest UI.
 *   - New `indexing` group with the seoNoindex boolean (SeoFieldRow's new
 *     "boolean" type — a checkbox).
 *   - `defaultKey`: which smart-default this field falls back to when
 *     empty (resolved by SeoEditor from the talent's own published data:
 *     name / bio / profile image / public URL), shown to the employee so
 *     "empty" reads as "using the automatic value," never as "broken."
 *
 * Fields are organized by what they actually affect: what shows up in a
 * Google search, what shows up when the link is shared on social media,
 * and whether search engines may index the page at all.
 *
 * Each field entry:
 *   - key         (string) — TalentVersion column name; used as the field
 *                  key end-to-end (UI state → PATCH payload → Prisma).
 *   - label       (string) — Hebrew display label, from he.seo.fields.
 *   - type        ("text" | "textarea" | "boolean") — SeoFieldRow's input
 *                  vocabulary.
 *   - helper      (string, optional) — plain-language explanation.
 *   - maxLength   (number, optional) — a *visual* character-count guide
 *                  only, never enforced.
 *   - defaultKey  ("name" | "bio" | "profileImage" | "publicUrl",
 *                  optional) — which smart default applies when empty.
 *   - dir         ("ltr", optional) — input direction override for
 *                  URL-valued fields inside the RTL admin.
 */

import { he } from './i18n/he';

export const SEO_FIELD_GROUPS = [
  {
    key: 'search',
    label: he.seo.groups.search,
    fields: [
      {
        key: 'seoTitle',
        label: he.seo.fields.title,
        type: 'text',
        helper: he.seo.fields.titleHelper,
        maxLength: 60,
        defaultKey: 'name',
      },
      {
        key: 'seoDescription',
        label: he.seo.fields.description,
        type: 'textarea',
        helper: he.seo.fields.descriptionHelper,
        maxLength: 160,
        defaultKey: 'bio',
      },
      {
        key: 'seoCanonicalUrl',
        label: he.seo.fields.canonicalUrl,
        type: 'text',
        helper: he.seo.fields.canonicalUrlHelper,
        defaultKey: 'publicUrl',
        dir: 'ltr',
      },
    ],
  },
  {
    key: 'social',
    label: he.seo.groups.social,
    fields: [
      {
        key: 'seoOgTitle',
        label: he.seo.fields.ogTitle,
        type: 'text',
        helper: he.seo.fields.ogTitleHelper,
        defaultKey: 'name',
      },
      {
        key: 'seoOgDescription',
        label: he.seo.fields.ogDescription,
        type: 'textarea',
        helper: he.seo.fields.ogDescriptionHelper,
        defaultKey: 'bio',
      },
      {
        key: 'seoOgImageUrl',
        label: he.seo.fields.ogImage,
        type: 'text',
        helper: he.seo.fields.ogImageHelper,
        defaultKey: 'profileImage',
        dir: 'ltr',
      },
    ],
  },
  {
    key: 'indexing',
    label: he.seo.groups.indexing,
    fields: [
      {
        key: 'seoNoindex',
        label: he.seo.fields.noindex,
        type: 'boolean',
        helper: he.seo.fields.noindexHelper,
      },
    ],
  },
];

/** Flat list of every SEO field key — the exact PATCH payload key set. */
export const SEO_FIELD_KEYS = SEO_FIELD_GROUPS.flatMap((group) =>
  group.fields.map((field) => field.key)
);

export default SEO_FIELD_GROUPS;
