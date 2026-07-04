"use client";

/*
 * PodcastTab — Podcast tab sprint, extended by the "Enable Podcast Save"
 * sprint.
 *
 * Dedicated "פודקאסט" tab (sibling of Details/Gallery/Socials/SEO/History)
 * for the TalentVersion podcast* fields — the single place podcast data is
 * shown or edited (Podcast Panel Removal cleanup sprint removed the
 * standalone read-only preview that used to sit above the tabs).
 *
 * Enable Podcast Save sprint — this component no longer owns its own
 * inputs/local state for podcastTitle/podcastDescriptionHe/
 * podcastDescriptionEn/podcastVideoEmbedUrl. Those four fields are now
 * rendered and saved by <TalentDetailsEditor> + <ComparisonView> — the
 * exact same Save Draft / Submit machinery the פרטים tab already uses
 * (same PATCH .../proposals/[versionId] route, same talentRepository.
 * updateTalentVersionFields allowlist, now extended to include these four
 * columns — see that file's WRITABLE_COLUMNS). No new save mechanism, no
 * new API route, per this sprint's explicit instruction to reuse the
 * existing one. `versionId`/`versionStatus` are null whenever there's no
 * editable DRAFT/PROPOSED version, in which case <TalentDetailsEditor>
 * itself disables Save Draft/Submit — the same "nothing to act on yet"
 * state the פרטים tab already shows; `copy.noEditableVersionHint` below
 * just explains *why* in this tab's own context.
 *
 * Still out of scope, unchanged from the previous sprint:
 *  - "החלף תמונה" (replace image) — disabled placeholder, no upload flow
 *    exists yet, and podcastImageAssetId is deliberately not part of the
 *    writable allowlist this sprint either (sprint rule #2).
 *  - The YouTube link/image preview shown here reflect the *published*
 *    version's current values (read-only) — editing the video URL happens
 *    via the proposed-column input in the editor below, not by typing
 *    into this link/preview area.
 *
 * Podcast tab UX polish sprint — when `hasPodcastData` is false (published
 * version has no podcast fields set at all), the placeholder-filled
 * preview column (empty image frame, disabled button, "no link" span) is
 * no longer rendered — it added noise for the common case of a talent
 * with no podcast yet. A clean <EmptyState> card is shown instead. The
 * editor below is unaffected either way: it's still always rendered, with
 * the same disabled-when-no-draft behavior as before, so editing is
 * unchanged from prior sprints.
 *
 * Talent Detail UX Refactor, Phase 2 — the image/video preview used to be
 * its own full-height column standing beside the editor (two visual blocks
 * side by side, the same "heavy" pattern Phase 1 removed from ComparisonView
 * itself). It is now a single compact row (small thumbnail + actions) above
 * the editor, so the tab reads as one section: a light read-only accessory
 * followed directly by the one editing surface, instead of two competing
 * columns. Purely a layout change — `hasPodcastData`/`podcastImageUrl`/
 * `podcastVideoEmbedUrl` still drive exactly the same conditions as before,
 * and the editor itself (<TalentDetailsEditor>/<ComparisonView>) is
 * untouched.
 *
 * Props:
 *   talentId              — string
 *   versionId             — string | null, the editable DRAFT/PROPOSED
 *                           version's id, or null if none (same contract
 *                           as <TalentDetailsEditor>)
 *   versionStatus         — "DRAFT" | "PROPOSED" | null
 *   groups                — ComparisonView's `groups` prop (buildPodcastGroups)
 *   podcastImageUrl        — ImageAsset.blobUrl, or null
 *   podcastVideoEmbedUrl  — string | null (published value, for the
 *                           read-only "צפייה ביוטיוב" link)
 *   hasPodcastData        — boolean — whether the published version has any
 *                           podcast field set at all (drives the empty state)
 *   displayName           — talent's display name, for image alt text
 */

import styles from "./PodcastTab.module.css";
import EmptyState from "./EmptyState";
import PrimaryButton from "./PrimaryButton";
import TalentDetailsEditor from "./TalentDetailsEditor";
import { he } from "@/lib/admin/i18n/he";

export default function PodcastTab({
  talentId,
  versionId,
  versionStatus = null,
  groups,
  podcastImageUrl,
  podcastVideoEmbedUrl,
  hasPodcastData,
  displayName,
  role = null,
}) {
  const copy = he.talent.detail.podcastTab;

  const editorColumn = (
    <div className={styles.editorColumn}>
      <TalentDetailsEditor
        talentId={talentId}
        versionId={versionId}
        versionStatus={versionStatus}
        groups={groups}
        role={role}
      />
    </div>
  );

  if (!hasPodcastData) {
    return (
      <div className={styles.tab}>
        <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />

        {!versionId ? <p className={styles.noEditableVersionHint}>{copy.noEditableVersionHint}</p> : null}

        <div className={styles.body}>{editorColumn}</div>
      </div>
    );
  }

  return (
    <div className={styles.tab}>
      {!versionId ? <p className={styles.noEditableVersionHint}>{copy.noEditableVersionHint}</p> : null}

      <div className={styles.body}>
        <div className={styles.previewRow}>
          <span className={styles.previewLabel}>{copy.imageLabel}</span>
          <div className={styles.previewRowContent}>
            <div className={styles.frame}>
              {podcastImageUrl ? (
                <img
                  src={podcastImageUrl}
                  alt={copy.imageAlt(displayName)}
                  className={styles.image}
                />
              ) : (
                <div className={styles.placeholder} aria-hidden="true">
                  {copy.noImage}
                </div>
              )}
            </div>

            <div className={styles.previewActions}>
              <button type="button" className={styles.imageButton} disabled>
                {copy.replaceImage}
              </button>
              <p className={styles.comingSoonHint}>{copy.comingSoonHint}</p>

              {podcastVideoEmbedUrl ? (
                <PrimaryButton
                  href={podcastVideoEmbedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.youtubeButton}
                >
                  {copy.viewOnYoutube}
                </PrimaryButton>
              ) : (
                <span className={styles.noVideoLink}>{copy.noVideoLink}</span>
              )}
            </div>
          </div>
        </div>

        {editorColumn}
      </div>
    </div>
  );
}
