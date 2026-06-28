/*
 * SocialLinksOwnerReview — Owner Review (Social Links) sprint.
 *
 * Read-only panel showing exactly what a submitted Social Links proposal
 * (TalentSocial rows with versionStatus = PROPOSED) would change, before
 * any approval action exists. Renders above <SocialLinksEditor> on the
 * Socials tab, conditionally — only when at least one PROPOSED row exists
 * for the talent — and never modifies that editor's behavior.
 *
 * Deliberately has NO approve/reject/publish controls: no API route for
 * any of those exists yet for Social Links (confirmed by inspecting every
 * app/api/admin/talent/[id]/socials* route — only Save Draft and Submit
 * exist), so per this sprint's explicit scope this stays informational
 * only. Wiring real actions in is future work, same as ComparisonView's
 * "Editable PROPOSED... until a future sprint's Owner review locks it"
 * note already flags.
 *
 * Visual language deliberately mirrors ComparisonView / SocialLinksEditor's
 * "Current Published / Proposed" eyebrow + card structure (see
 * SocialLinksOwnerReview.module.css), but per-account, side-by-side, with a
 * status badge driven by lib/admin/social-review.js's diff — the first real
 * diff in the admin panel (every other `.changeDot`-style placeholder
 * elsewhere is still inert).
 *
 * Props:
 *   - publishedSocials (TalentSocial[], optional, default []) — current
 *     Published+Active rows (same shape as SocialLinksEditor's
 *     `publishedSocials`).
 *   - proposedSocials (TalentSocial[], optional, default []) — current
 *     PROPOSED rows for this talent (talentAdapter.getProposedSocials).
 */

import styles from "./SocialLinksOwnerReview.module.css";
import StatusBadge from "./StatusBadge";
import { he } from "@/lib/admin/i18n/he";
import { getPlatformEntry } from "@/lib/admin/social-platforms";
import {
  buildSocialReviewItems,
  summarizeSocialReview,
  SOCIAL_REVIEW_STATUS,
} from "@/lib/admin/social-review";

const STATUS_TONE = {
  [SOCIAL_REVIEW_STATUS.ADDED]: "success",
  [SOCIAL_REVIEW_STATUS.CHANGED]: "warning",
  [SOCIAL_REVIEW_STATUS.UNCHANGED]: "neutral",
  [SOCIAL_REVIEW_STATUS.UNCHANGED_PUBLISHED_ONLY]: "neutral",
  [SOCIAL_REVIEW_STATUS.REMOVED]: "danger",
};

function formatHebrewDate(value) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString("he-IL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

function fieldChanged(changedFields, field) {
  return changedFields.includes(field);
}

function AccountFieldsReadOnly({ account, changedFields = [] }) {
  if (!account) {
    return <p className={styles.noAccountNote}>{he.social.review.noCurrentAccount}</p>;
  }

  const platformEntry = getPlatformEntry(account.platform);
  const platformLabel = platformEntry?.label || account.platform;
  const platformIcon = platformEntry?.icon || "🔗";
  const labelText = he.social.labels[account.label] || account.label;

  return (
    <div className={styles.accountFields}>
      <div className={styles.accountHeader}>
        <span className={styles.platformIcon} aria-hidden="true">
          {platformIcon}
        </span>
        <span className={fieldChanged(changedFields, "platform") ? styles.platformNameChanged : styles.platformName}>
          {platformLabel}
        </span>
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>{he.social.fields.label}</span>
        <span className={fieldChanged(changedFields, "label") ? styles.valueChanged : styles.value}>
          {labelText}
        </span>
      </div>

      {account.label === "OTHER" ? (
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>{he.social.fields.customLabel}</span>
          <span
            className={
              fieldChanged(changedFields, "customLabel")
                ? styles.valueChanged
                : account.customLabel
                  ? styles.value
                  : styles.emptyValue
            }
          >
            {account.customLabel || he.social.notSet}
          </span>
        </div>
      ) : null}

      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>{he.social.fields.handle}</span>
        <span
          dir="ltr"
          className={
            fieldChanged(changedFields, "handle")
              ? styles.valueChangedLtr
              : account.handle
                ? styles.valueLtr
                : styles.emptyValue
          }
        >
          {account.handle ? `@${account.handle.replace(/^@+/, "")}` : he.social.notSet}
        </span>
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>{he.social.fields.url}</span>
        <span
          dir="ltr"
          className={
            fieldChanged(changedFields, "url")
              ? styles.valueChangedLtr
              : account.url
                ? styles.valueLtr
                : styles.emptyValue
          }
        >
          {account.url || he.social.notSet}
        </span>
      </div>
    </div>
  );
}

function ReviewItemCard({ item }) {
  const { status, published, proposed, changedFields } = item;
  const statusLabel = he.social.review.status[status] || status;
  const tone = STATUS_TONE[status] || "neutral";
  const proposedAt = formatHebrewDate(proposed?.createdAt);
  const proposedByEmail = proposed?.createdBy?.email;

  return (
    <div className={styles.itemCard}>
      <div className={styles.itemHeader}>
        <StatusBadge label={statusLabel} tone={tone} />
        {proposed && (proposedAt || proposedByEmail) ? (
          <span className={styles.itemMeta}>
            {proposedByEmail ? `${he.social.review.proposedBy} ${proposedByEmail}` : null}
            {proposedByEmail && proposedAt ? " · " : null}
            {proposedAt ? `${he.social.review.proposedAt} ${proposedAt}` : null}
          </span>
        ) : null}
      </div>

      <div className={styles.itemColumns}>
        <section className={styles.itemColumn} aria-label={he.social.review.currentColumnTitle}>
          <p className={styles.columnTitle}>{he.social.review.currentColumnTitle}</p>
          <AccountFieldsReadOnly account={published} />
        </section>

        {proposed ? (
          <section className={styles.itemColumnProposed} aria-label={he.social.review.proposedColumnTitle}>
            <p className={styles.columnTitleProposed}>{he.social.review.proposedColumnTitle}</p>
            <AccountFieldsReadOnly account={proposed} changedFields={changedFields} />
          </section>
        ) : null}
      </div>
    </div>
  );
}

export default function SocialLinksOwnerReview({ publishedSocials = [], proposedSocials = [] }) {
  if (!proposedSocials || proposedSocials.length === 0) {
    return null;
  }

  const items = buildSocialReviewItems(publishedSocials, proposedSocials);
  const summary = summarizeSocialReview(items);
  const hasRemovedItems = summary.removed > 0;

  return (
    <div className={styles.tokens}>
      <header className={styles.eyebrow}>
        <span className={styles.eyebrowIcon} aria-hidden="true">
          {he.social.review.eyebrowIcon}
        </span>
        <span className={styles.eyebrowTitle}>{he.social.review.title}</span>
      </header>
      <p className={styles.subtitle}>{he.social.review.subtitle}</p>

      <div className={styles.summaryRow}>
        {summary.added > 0 ? (
          <StatusBadge label={`${summary.added} ${he.social.review.summary.added}`} tone="success" />
        ) : null}
        {summary.changed > 0 ? (
          <StatusBadge label={`${summary.changed} ${he.social.review.summary.changed}`} tone="warning" />
        ) : null}
        {summary.removed > 0 ? (
          <StatusBadge label={`${summary.removed} ${he.social.review.summary.removed}`} tone="danger" />
        ) : null}
      </div>

      <div className={styles.itemList}>
        {items.map((item) => (
          <ReviewItemCard key={item.key} item={item} />
        ))}
      </div>

      {hasRemovedItems ? <p className={styles.limitationNote}>{he.social.review.removalLimitationNote}</p> : null}

      <p className={styles.pendingNote} role="note">
        {he.social.review.pendingNote}
      </p>
    </div>
  );
}
