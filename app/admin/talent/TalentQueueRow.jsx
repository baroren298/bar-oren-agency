/*
 * TalentQueueRow — Talent Workspace Foundation sprint.
 *
 * One card of the Talent list (./page.jsx). Local to app/admin/talent/
 * rather than components/admin/ for now, same reasoning as
 * app/admin/my-work/WorkflowItemCard.jsx: a one-page composition of
 * existing primitives (Card, StatusBadge) with no proven need elsewhere
 * yet. Plain presentational component — no "use client", no hooks.
 *
 * Talent List Visual Redesign (Correction sprint): rebuilt as a vertical
 * card (large image on top, text below) instead of the previous dense
 * horizontal row, per the corrected direction — "larger image, cleaner
 * card layout, name prominent, location visible, social preview subtle,
 * status badge, פתח תיק action, no tag chips in the list."
 *
 * Category/tag chips are intentionally removed from this view per that
 * correction ("hide the category/tag chips... they make the list
 * visually noisy"). `localizeCategoryLabel` and the underlying
 * `category`/`tags` data are untouched and still used by
 * TalentListClient.jsx's search haystack — only the chip *rendering* here
 * is removed, nothing about the data or localization helper changed.
 *
 * Talent List Polish (read-only) sprint: removed the small leading
 * "published" dot that had been added in the Card Polish sprint — it read
 * too close to an interactive toggle/switch, which this badge must not be
 * (the real visibility ON/OFF control will live on the talent detail page
 * only, behind a real schema field — see TalentListClient.jsx's header
 * comment). Back to a single, clean <StatusBadge>; no dot, no extra
 * wrapper markup.
 *
 * Talent Visibility sprint (admin UI): that real schema field now exists
 * and the toggle lives on the detail page (TalentVisibilityAction.jsx), per
 * the plan above. This adds exactly one more inert, muted <StatusBadge> —
 * "מוסתר" — next to the existing workflow badge, shown only for a Hidden
 * talent (isListTalentHidden now reads the real `talent.visibility` field
 * instead of always returning false). A Visible talent gets no extra badge
 * at all, matching requirement #6 and this same "no toggle-like markup in
 * the list" precedent — this sprint adds no filtering/search hookup here,
 * that's explicitly out of scope.
 */

import Link from 'next/link';
import Card from '@/components/admin/Card';
import StatusBadge from '@/components/admin/StatusBadge';
import TalentImage from '@/components/ui/TalentImage';
import {
  deriveListWorkflowStatus,
  deriveListSocialPreview,
  workflowStatusLabel,
  workflowStatusTone,
  isListTalentHidden,
} from '@/lib/admin/talent-workspace';
import { he } from '@/lib/admin/i18n/he';
import styles from './talent.module.css';

export default function TalentQueueRow({ talent }) {
  const status = deriveListWorkflowStatus(talent);
  const tone = workflowStatusTone(status);
  const displayName = talent.name || talent.nameEn || talent.slug;
  const location = talent.location || talent.locationEn;
  const social = deriveListSocialPreview(talent.socialPreview);
  const hidden = isListTalentHidden(talent);

  return (
    <Link href={`/admin/talent/${talent.id}`} className={styles.rowLink} aria-label={`${he.talent.list.openFolder}: ${displayName}`}>
      <Card as="article">
        <div className={styles.rowMain}>
          <div className={styles.rowThumb}>
            <div className={styles.rowThumbBadge}>
              <span className={styles.badgeWrap}>
                <StatusBadge label={workflowStatusLabel(status)} tone={tone} />
              </span>
              {hidden ? (
                <span className={styles.badgeWrap}>
                  <StatusBadge label={he.talent.list.hiddenBadge} tone="neutral" />
                </span>
              ) : null}
            </div>
            <TalentImage src={talent.profileImageUrl} alt="" />
          </div>

          <div className={styles.rowBody}>
            <div className={styles.rowHeader}>
              <h3 className={styles.rowName}>{displayName}</h3>
            </div>

            <div className={styles.rowMeta}>
              <span>{location || he.talent.list.noLocation}</span>
            </div>

            {social ? (
              // Talent Visibility sprint (Issue 2 fix) — `social.text` is a
              // Latin-script handle/URL inside this dir="rtl" page (see
              // app/admin/layout.jsx). Without an explicit dir="ltr", the
              // browser's bidi algorithm can reorder a value like
              // "@@kimchourilov" so the "@@" renders at the visual end
              // instead of the start. components/admin/SocialLinkRow.jsx
              // already wraps every Latin-script value this same way for
              // the same reason (see that file's header comment) — this
              // just applies the existing convention here too.
              <p className={styles.rowSocial}>
                {social.icon} <span dir="ltr">{social.text}</span>
              </p>
            ) : null}

            <div className={styles.rowAffordance} aria-hidden="true">
              <span className={styles.rowAffordanceLabel}>{he.talent.list.openFolder}</span>
              {/*
                RTL Arrow Fix — Talent List Polish sprint. The page is
                dir="rtl" (app/admin/layout.jsx), and U+2039/U+203A
                ("‹"/"›") are both in Unicode's BidiMirroring table: inside
                an RTL run, the browser auto-mirrors whichever one is in
                the source into the *other* one's glyph. The previous
                source character here was "‹" ("less-than"-shaped), which
                — once auto-mirrored for RTL — actually rendered pointing
                right (toward the label, i.e. backward/into the page, the
                wrong way for an "open this" affordance). Using "›" as the
                source character instead means the RTL auto-mirror flips
                it the other way, rendering as a left-pointing arrow on
                screen — correct for RTL, where "forward" reads
                right-to-left, and consistent with this row's existing
                hover animation (.rowAffordanceArrow's translateX(-3px)
                already nudges it further left on hover/focus).
              */}
              <span className={styles.rowAffordanceArrow}>›</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
