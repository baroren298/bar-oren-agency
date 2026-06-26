/*
 * SEO field registry — SEO Editor Foundation sprint.
 *
 * Single source of truth for "which SEO fields does the admin know about,"
 * same role social-platforms.js plays for SocialLinksEditor. SeoEditor/
 * SeoFieldRow are entity-agnostic — they just render one group/row per
 * entry in whatever `groups` array they're given. Adding a new SEO field
 * later (e.g. a canonical URL, a robots toggle) is a one-line addition
 * here — no change needed to SeoEditor, SeoFieldRow, SearchResultPreview,
 * or any CSS module.
 *
 * Today's only caller is the talent workspace's SEO tab, but the shape is
 * deliberately generic — no talent-specific field, no required value — so
 * the same registry can back talent pages, the homepage, about/contact/
 * legal pages, or any other site content page later, per this sprint's
 * "Reusable Components" / "Future Ready" requirements.
 *
 * Fields are organized into two groups, mirroring how an employee actually
 * thinks about this: "what shows up in a Google search" vs. "what shows up
 * when this link is shared on social media."
 *
 * Each field entry:
 *   - key         (string) — stable identifier, used as the field key.
 *   - label       (string) — Hebrew display label, sourced from
 *                  he.seo.fields so all admin copy stays in one place.
 *   - type        ("text" | "textarea" | "list") — same vocabulary
 *                  ComparisonView already uses ("list" = comma-separated
 *                  values, e.g. keywords/tags).
 *   - helper      (string, optional) — short, plain-language explanation
 *                  shown under the field's label in the proposed column.
 *   - maxLength   (number, optional) — a *visual* character-count guide
 *                  only (e.g. "42/60 תווים"). Not enforced anywhere — no
 *                  real validation per this sprint's explicit scope.
 */

import { he } from './i18n/he';

export const SEO_FIELD_GROUPS = [
  {
    key: 'search',
    label: he.seo.groups.search,
    fields: [
      { key: 'title', label: he.seo.fields.title, type: 'text', helper: he.seo.fields.titleHelper, maxLength: 60 },
      {
        key: 'description',
        label: he.seo.fields.description,
        type: 'textarea',
        helper: he.seo.fields.descriptionHelper,
        maxLength: 160,
      },
      { key: 'keywords', label: he.seo.fields.keywords, type: 'list', helper: he.seo.fields.keywordsHelper },
    ],
  },
  {
    key: 'social',
    label: he.seo.groups.social,
    fields: [
      { key: 'ogTitle', label: he.seo.fields.ogTitle, type: 'text', helper: he.seo.fields.ogTitleHelper },
      {
        key: 'ogDescription',
        label: he.seo.fields.ogDescription,
        type: 'textarea',
        helper: he.seo.fields.ogDescriptionHelper,
      },
    ],
  },
];

export default SEO_FIELD_GROUPS;
