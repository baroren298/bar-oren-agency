/*
 * ProfileImagePanel — Profile Image section sprint.
 *
 * Replaces the small circular avatar that used to sit in the workspace
 * header (see app/admin/talent/[id]/page.jsx's old <ProfileSummary>) with a
 * dedicated, clearly-labelled "Profile Image" section. Two things changed
 * on purpose, nothing else:
 *
 *  1. Shape — rectangular, aspect-ratio 3 / 4, matching the public site's
 *     primary portrait ratio (components/talent/ProfileHero.module.css's
 *     `.imageCol`, the talent profile page's main photo). The public site
 *     tightens to 4 / 5 on small screens, but a single admin preview can't
 *     be "two ratios at once" — 3 / 4 is the one used for the photo's most
 *     prominent placement, so that's what this preview targets. The old
 *     circular avatar didn't represent either ratio at all.
 *  2. Framing — its own titled section ("תמונת פרופיל") instead of an
 *     unlabelled thumbnail floating next to the name.
 *
 * Still read-only: this renders profileImagePosition/profileImageScale
 * with the exact same object-position / transform: scale technique the
 * previous header avatar used (and the public TalentImage component uses)
 * so the preview matches the actually-published crop — it does not
 * recompute or reinterpret those values. No upload, no drag-to-reposition,
 * no zoom slider. The three buttons below the preview (Replace image /
 * Crop · Position / Zoom · Scale) are intentionally disabled placeholders
 * with reserved layout space — wiring them up is explicitly a future
 * sprint's job per this sprint's brief, not this one's.
 *
 * Props:
 *   imageUrl              — ImageAsset.blobUrl, or null when no profile
 *                           image has been published yet
 *   profileImagePosition  — CSS object-position string, or null
 *   profileImageScale     — number (CSS transform: scale factor), or null
 *   displayName           — talent's display name, for alt text
 */

import styles from './ProfileImagePanel.module.css';
import { he } from '@/lib/admin/i18n/he';

export default function ProfileImagePanel({ imageUrl, profileImagePosition, profileImageScale, displayName }) {
  const copy = he.talent.detail.profile.image;

  const imageStyle = {
    objectPosition: profileImagePosition || 'center top',
    transform: profileImageScale ? `scale(${profileImageScale})` : undefined,
  };

  return (
    <section className={styles.panel} aria-labelledby="profile-image-heading">
      <div className={styles.heading}>
        <h2 id="profile-image-heading" className={styles.title}>
          {copy.sectionTitle}
        </h2>
      </div>

      <div className={styles.body}>
        <div className={styles.previewColumn}>
          <span className={styles.previewLabel}>{copy.previewLabel}</span>
          <div className={styles.frame}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={he.talent.detail.profile.imageAlt(displayName)}
                className={styles.image}
                style={imageStyle}
              />
            ) : (
              <div className={styles.placeholder} aria-hidden="true">
                {he.talent.detail.profile.noImage}
              </div>
            )}
          </div>
        </div>

        {/*
          Reserved for the future upload/crop/zoom sprint. Disabled on
          purpose — this sprint keeps the page strictly read-only — but the
          space, labels, and grouping are already in place so that sprint
          only has to remove `disabled`, not redesign the layout.
        */}
        <div className={styles.controlsColumn}>
          <button type="button" className={styles.controlButton} disabled>
            {copy.controls.replace}
          </button>
          <button type="button" className={styles.controlButton} disabled>
            {copy.controls.crop}
          </button>
          <button type="button" className={styles.controlButton} disabled>
            {copy.controls.zoom}
          </button>
          <p className={styles.comingSoonHint}>{copy.comingSoonHint}</p>
        </div>
      </div>
    </section>
  );
}
