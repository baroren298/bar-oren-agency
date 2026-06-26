"use client";

/*
 * SocialLinksEditor — Social Links Editor Foundation sprint.
 *
 * The social-links counterpart to ComparisonView/MediaGalleryEditor: the
 * same "Current Published / Proposed Update" philosophy, applied to a
 * fixed set of platform rows instead of free-form fields or an image grid.
 * An employee always sees what's actually live (read-only, via SocialLinkRow
 * in readOnly mode) and separately shapes a proposed set of links beneath it
 * (editable rows, same component) — nothing here ever touches the live site.
 *
 * Entity-agnostic, same reasoning as its siblings: this component knows
 * nothing about "talent" specifically, only a `platforms` registry
 * ({ key, label, icon }[], from lib/admin/social-platforms.js by default)
 * and a flat `publishedLinks` map ({ [platformKey]: string|null }). That's
 * what makes it reusable, unchanged, for agency social links, contact info,
 * footer links, or brand pages later — each caller just supplies its own
 * `publishedLinks` (and optionally a different `platforms` list, e.g. one
 * without "Website").
 *
 * Strictly UI-only, per this sprint's explicit scope:
 *   - No persistence, no API calls, no database writes.
 *   - No URL/username validation against real platforms.
 *   - "ביטול שינויים" only resets the in-memory proposed values back to
 *     published — same local-state-isn't-persistence reasoning every other
 *     editor here already uses. "שמור כטיוטה"/"שלח לאישור" stay disabled
 *     placeholders via EditorActionBar's existing defaults.
 *
 * Future Ready: adding a new platform is a one-line addition to
 * lib/admin/social-platforms.js — no change needed here, in SocialLinkRow,
 * or in any CSS module, since both components only ever map over whatever
 * `platforms` array they're given.
 *
 * Props:
 *   - publishedLinks ({ [platformKey]: string|null }, optional, default {})
 *   - platforms ({ key, label, icon }[], optional, default SOCIAL_PLATFORMS)
 */

import { useState } from "react";
import styles from "./SocialLinksEditor.module.css";
import SocialLinkRow from "./SocialLinkRow";
import EditorHelperNote from "./EditorHelperNote";
import EditorActionBar from "./EditorActionBar";
import { he } from "@/lib/admin/i18n/he";
import { SOCIAL_PLATFORMS } from "@/lib/admin/social-platforms";

function buildInitialValues(platforms, publishedLinks) {
  return platforms.reduce((acc, platform) => {
    acc[platform.key] = publishedLinks[platform.key] ?? null;
    return acc;
  }, {});
}

export default function SocialLinksEditor({ publishedLinks = {}, platforms = SOCIAL_PLATFORMS }) {
  const [proposedValues, setProposedValues] = useState(() =>
    buildInitialValues(platforms, publishedLinks)
  );

  function handleChange(key, value) {
    setProposedValues((previous) => ({ ...previous, [key]: value }));
  }

  // Local-only reset — never talks to a server, just discards whatever the
  // employee typed and snaps the proposed rows back to published, in memory.
  function handleCancel() {
    setProposedValues(buildInitialValues(platforms, publishedLinks));
  }

  return (
    <div className={styles.tokens}>
      <div className={styles.comparison}>
        <section className={styles.publishedSection} aria-label={he.social.publishedEyebrowTitle}>
          <header className={styles.eyebrow}>
            <span className={styles.eyebrowIcon} aria-hidden="true">
              {he.social.publishedEyebrowIcon}
            </span>
            <span className={styles.eyebrowTitle}>{he.social.publishedEyebrowTitle}</span>
          </header>
          <p className={styles.publishedSubtitle}>{he.social.publishedSubtitle}</p>

          <div className={styles.rowList}>
            {platforms.map((platform) => (
              <SocialLinkRow
                key={platform.key}
                platform={platform}
                value={publishedLinks[platform.key] ?? null}
                readOnly
              />
            ))}
          </div>
        </section>

        <section className={styles.proposedSection} aria-label={he.social.proposedEyebrowTitle}>
          <header className={styles.eyebrow}>
            <span className={styles.eyebrowIcon} aria-hidden="true">
              {he.social.proposedEyebrowIcon}
            </span>
            <span className={styles.eyebrowTitleProposed}>{he.social.proposedEyebrowTitle}</span>
          </header>
          <p className={styles.proposedSubtitle}>{he.social.proposedSubtitle}</p>

          <div className={styles.rowList}>
            {platforms.map((platform) => (
              <SocialLinkRow
                key={platform.key}
                platform={platform}
                value={proposedValues[platform.key]}
                onChange={(value) => handleChange(platform.key, value)}
              />
            ))}
          </div>
        </section>
      </div>

      <EditorHelperNote />
      <EditorActionBar onCancel={handleCancel} />
    </div>
  );
}
