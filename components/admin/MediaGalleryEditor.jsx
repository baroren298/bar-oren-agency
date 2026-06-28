"use client";

/*
 * MediaGalleryEditor — Gallery Editor Foundation sprint, polished by the
 * Gallery UX Polish sprint.
 *
 * The image-gallery counterpart to ComparisonView.jsx: the same "Current
 * Published / Proposed Update" philosophy, applied to a grid of images
 * instead of a list of text fields. An employee always sees what is
 * actually live on the website (read-only, via PublishedMediaGrid), and
 * separately shapes a proposed gallery beneath it (editable cards, via
 * GalleryImageCard + AddImageCard) — nothing here ever touches the live
 * site directly.
 *
 * Deliberately entity-agnostic, same reasoning as ComparisonView: this
 * component knows nothing about "talent" specifically, only a flat list
 * of `{ src, alt }` images, so the same editor is meant to be reused
 * unchanged for talent galleries, the agency logo, hero image, profile
 * image, homepage media, or any other CMS image collection later — each
 * caller just supplies its own `publishedImages` and an entity-specific
 * empty-state copy if it wants one.
 *
 * Strictly UI-only, per this sprint's explicit scope:
 *   - No upload, no Cloudinary, no file picker, no drag-and-drop library.
 *   - No persistence, no API calls, no database writes.
 *   - "Remove" and "reorder" (move up/down) are real, but only against
 *     the in-memory `proposedImages` array — the same "local state isn't
 *     persistence" reasoning ComparisonView already applies to its
 *     "ביטול שינויים" reset. "Replace" and "+ הוסף תמונה" are disabled
 *     placeholders (see GalleryImageCard.jsx / AddImageCard.jsx) because
 *     they would need a real upload pipeline.
 *   - Ends with EditorActionBar (shared, unchanged) so "cancel" really
 *     resets the proposed grid back to published, and "save draft"/
 *     "submit" stay disabled with the same "coming soon" tooltip as
 *     everywhere else.
 *
 * Gallery UX Polish sprint — this tab no longer renders the shared
 * <EditorHelperNote>. That component's copy ("this is a proposed update;
 * nothing publishes until the owner approves it; you can save a draft and
 * continue later") describes the real Draft → Proposed → Published
 * workflow Details/Socials/Podcast already have wired up — none of that
 * exists for the gallery yet, so reusing it here would overstate what
 * this tab can actually do. <PreviewModeNotice> below replaces it with a
 * gallery-specific, honest equivalent; EditorHelperNote itself is
 * untouched and still used as-is by every other editor.
 *
 * Props:
 *   - publishedImages ({ src, alt }[]) — what's actually live; also the
 *     seed for the initial proposed grid
 *   - emptyPublishedTitle / emptyPublishedDescription (string, optional)
 *   - emptyProposedTitle / emptyProposedDescription (string, optional)
 */

import { useState } from "react";
import styles from "./MediaGalleryEditor.module.css";
import PublishedMediaGrid from "./PublishedMediaGrid";
import GalleryImageCard from "./GalleryImageCard";
import AddImageCard from "./AddImageCard";
import EmptyState from "./EmptyState";
import EditorActionBar from "./EditorActionBar";
import { he } from "@/lib/admin/i18n/he";

/*
 * Gallery-specific stand-in for the shared <EditorHelperNote>, styled like
 * PodcastTab's existing .noEditableVersionHint bordered hint box (same
 * admin-tokens palette, same "calm bordered note" language) so this tab
 * reads at the same visual quality as Podcast, without touching that
 * shared component or its copy.
 */
function PreviewModeNotice() {
  return (
    <div className={styles.previewNotice} role="note">
      <p className={styles.previewNoticeTitle}>{he.gallery.previewModeNotice.title}</p>
      <p className={styles.previewNoticeBody}>{he.gallery.previewModeNotice.body}</p>
    </div>
  );
}

function withIds(images) {
  return images.map((image, index) => ({ ...image, _key: `${image.src}-${index}` }));
}

export default function MediaGalleryEditor({
  publishedImages = [],
  emptyPublishedTitle = he.gallery.noPublishedImagesTitle,
  emptyPublishedDescription = he.gallery.noPublishedImagesDescription,
  emptyProposedTitle = he.gallery.noProposedImagesTitle,
  emptyProposedDescription = he.gallery.noProposedImagesDescription,
}) {
  const [proposedImages, setProposedImages] = useState(() => withIds(publishedImages));

  function handleReset() {
    setProposedImages(withIds(publishedImages));
  }

  function handleRemove(index) {
    setProposedImages((previous) => previous.filter((_, i) => i !== index));
  }

  function handleMove(index, direction) {
    setProposedImages((previous) => {
      const target = index + direction;
      if (target < 0 || target >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className={styles.tokens}>
      <section className={styles.publishedSection} aria-label={he.gallery.publishedEyebrowTitle}>
        <header className={styles.eyebrow}>
          <span className={styles.eyebrowIcon} aria-hidden="true">
            {he.gallery.publishedEyebrowIcon}
          </span>
          <span className={styles.eyebrowTitle}>{he.gallery.publishedEyebrowTitle}</span>
        </header>
        <p className={styles.publishedSubtitle}>{he.gallery.publishedSubtitle}</p>

        <PublishedMediaGrid
          images={publishedImages}
          emptyTitle={emptyPublishedTitle}
          emptyDescription={emptyPublishedDescription}
        />
      </section>

      <section className={styles.proposedSection} aria-label={he.gallery.proposedEyebrowTitle}>
        <header className={styles.eyebrow}>
          <span className={styles.eyebrowIcon} aria-hidden="true">
            {he.gallery.proposedEyebrowIcon}
          </span>
          <span className={styles.eyebrowTitleProposed}>{he.gallery.proposedEyebrowTitle}</span>
        </header>
        <p className={styles.proposedSubtitle}>{he.gallery.proposedSubtitle}</p>

        {proposedImages.length === 0 ? (
          <EmptyState
            title={emptyProposedTitle}
            description={emptyProposedDescription}
            action={<AddImageCard className={styles.emptyProposedAction} />}
          />
        ) : (
          <div className={styles.proposedGrid}>
            {proposedImages.map((image, index) => (
              <GalleryImageCard
                key={image._key}
                image={image}
                isFirst={index === 0}
                isLast={index === proposedImages.length - 1}
                onRemove={() => handleRemove(index)}
                onMoveUp={() => handleMove(index, -1)}
                onMoveDown={() => handleMove(index, 1)}
              />
            ))}
            <AddImageCard />
          </div>
        )}
      </section>

      <PreviewModeNotice />
      <EditorActionBar onCancel={handleReset} />
    </div>
  );
}
