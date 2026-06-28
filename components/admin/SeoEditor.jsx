"use client";

/*
 * SeoEditor — SEO Editor Foundation sprint.
 *
 * The SEO counterpart to ComparisonView/MediaGalleryEditor/SocialLinksEditor:
 * the same "Current Published / Proposed Update" philosophy, applied to a
 * fixed set of SEO fields (title, description, keywords, Open Graph title,
 * Open Graph description) grouped by what they actually affect ("shows up
 * in Google" vs. "shows up when shared on social media"). An employee
 * always sees what's actually published (read-only, via SeoFieldRow in
 * readOnly mode) and separately shapes a proposed set of values beneath it
 * (editable rows, same component), plus a live Google-result preview that
 * updates as they type — nothing here ever touches the live site.
 *
 * Entity-agnostic, same reasoning as its siblings: this component knows
 * nothing about "talent" specifically, only a `groups` registry
 * ({ key, label, fields: { key, label, type, helper, maxLength }[] }[],
 * from lib/admin/seo-fields.js by default) and a flat `publishedSeo` map
 * ({ [fieldKey]: string|string[]|null }). That's what makes it reusable,
 * unchanged, for talent pages, the homepage, about/contact/legal pages, or
 * any other site content page later — each caller just supplies its own
 * `publishedSeo`.
 *
 * Strictly UI-only, per this sprint's explicit scope:
 *   - No persistence, no API calls, no database writes.
 *   - No real SEO scoring, no keyword analysis, no character-limit
 *     enforcement (maxLength on a field is a visual guide only).
 *   - "ביטול שינויים" only resets the in-memory proposed values back to
 *     published — same local-state-isn't-persistence reasoning every other
 *     editor here already uses. "שמור כטיוטה"/"שלח לאישור" stay disabled
 *     placeholders via EditorActionBar's existing defaults.
 *
 * Future Ready: adding a new SEO field is a one-line addition to
 * lib/admin/seo-fields.js — no change needed here, in SeoFieldRow,
 * SearchResultPreview, or any CSS module.
 *
 * Props:
 *   - publishedSeo ({ [fieldKey]: string|string[]|null }, optional,
 *     default {})
 *   - groups ({ key, label, fields }[], optional, default SEO_FIELD_GROUPS)
 *   - previewUrl (string, optional) — passed through to SearchResultPreview
 */

import { useState } from "react";
import styles from "./SeoEditor.module.css";
import SeoFieldRow from "./SeoFieldRow";
import SearchResultPreview from "./SearchResultPreview";
import EditorActionBar from "./EditorActionBar";
import { he } from "@/lib/admin/i18n/he";
import { SEO_FIELD_GROUPS } from "@/lib/admin/seo-fields";

/*
 * SEO-specific stand-in for the retired shared <EditorHelperNote>, same
 * pattern as MediaGalleryEditor's/SocialLinksEditor's own PreviewModeNotice:
 * states plainly that this tab is preview-only and nothing here is saved or
 * published, instead of the old no-op note that said nothing at all.
 */
function PreviewModeNotice() {
  return (
    <div className={styles.previewNotice} role="note">
      <p className={styles.previewNoticeTitle}>{he.seo.previewModeNotice.title}</p>
      <p className={styles.previewNoticeBody}>{he.seo.previewModeNotice.body}</p>
    </div>
  );
}

function buildInitialValues(groups, publishedSeo) {
  return groups.reduce((acc, group) => {
    group.fields.forEach((field) => {
      acc[field.key] = publishedSeo[field.key] ?? (field.type === "list" ? [] : null);
    });
    return acc;
  }, {});
}

export default function SeoEditor({ publishedSeo = {}, groups = SEO_FIELD_GROUPS, previewUrl }) {
  const [proposedValues, setProposedValues] = useState(() => buildInitialValues(groups, publishedSeo));

  function handleChange(key, value) {
    setProposedValues((previous) => ({ ...previous, [key]: value }));
  }

  // Local-only reset — never talks to a server, just discards whatever the
  // employee typed and snaps the proposed fields back to published, in
  // memory.
  function handleCancel() {
    setProposedValues(buildInitialValues(groups, publishedSeo));
  }

  return (
    <div className={styles.tokens}>
      <p className={styles.intro}>{he.seo.intro}</p>

      <div className={styles.comparison}>
        <section className={styles.publishedSection} aria-label={he.seo.publishedEyebrowTitle}>
          <header className={styles.eyebrow}>
            <span className={styles.eyebrowIcon} aria-hidden="true">
              {he.seo.publishedEyebrowIcon}
            </span>
            <span className={styles.eyebrowTitle}>{he.seo.publishedEyebrowTitle}</span>
          </header>
          <p className={styles.publishedSubtitle}>{he.seo.publishedSubtitle}</p>

          <div className={styles.groupedFieldList}>
            {groups.map((group) => (
              <div key={group.key} className={styles.fieldGroup}>
                {group.label ? <h3 className={styles.groupLabel}>{group.label}</h3> : null}
                <div className={styles.fieldList}>
                  {group.fields.map((field) => (
                    <SeoFieldRow key={field.key} field={field} value={publishedSeo[field.key] ?? null} readOnly />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.proposedSection} aria-label={he.seo.proposedEyebrowTitle}>
          <header className={styles.eyebrow}>
            <span className={styles.eyebrowIcon} aria-hidden="true">
              {he.seo.proposedEyebrowIcon}
            </span>
            <span className={styles.eyebrowTitleProposed}>{he.seo.proposedEyebrowTitle}</span>
          </header>
          <p className={styles.proposedSubtitle}>{he.seo.proposedSubtitle}</p>

          <div className={styles.groupedFieldList}>
            {groups.map((group) => (
              <div key={group.key} className={styles.fieldGroup}>
                {group.label ? <h3 className={styles.groupLabelProposed}>{group.label}</h3> : null}
                <div className={styles.fieldList}>
                  {group.fields.map((field) => (
                    <SeoFieldRow
                      key={field.key}
                      field={field}
                      value={proposedValues[field.key]}
                      onChange={(value) => handleChange(field.key, value)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.previewWrapper}>
            <SearchResultPreview
              title={proposedValues.title}
              description={proposedValues.description}
              url={previewUrl}
            />
          </div>
        </section>
      </div>

      <PreviewModeNotice />
      <EditorActionBar onCancel={handleCancel} showSaveDraft={false} showSubmit={false} />
    </div>
  );
}
