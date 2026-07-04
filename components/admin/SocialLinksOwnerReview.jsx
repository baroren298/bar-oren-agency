"use client";

/*
 * SocialLinksOwnerReview — Owner Review (Social Links) sprint, extended by
 * the Owner Approve/Reject (Social Links) sprint.
 *
 * Was (Owner Review sprint): a read-only panel showing exactly what a
 * submitted Social Links proposal (TalentSocial rows with versionStatus =
 * PROPOSED) would change, with no approve/reject/publish controls — none of
 * those API routes existed yet.
 *
 * Is: every reviewed item that has a `proposed` row now gets two real
 * actions — "אשר ופרסם" (Approve, POST .../socials/[socialId]/approve) and
 * "בקש שינויים" (Request changes / Reject, which reveals a required note
 * field before POSTing .../socials/[socialId]/reject). Becoming a "use
 * client" component is the only structural change this required: the
 * existing diff/comparison markup (AccountFieldsReadOnly, the
 * Current/Proposed columns, the summary row) is completely unchanged — only
 * each ReviewItemCard gained an actions row beneath its columns.
 *
 * Both actions are Owner-only at the API layer (requireOwner) — this
 * component does not attempt its own role gating; if a non-Owner session
 * somehow renders this panel and clicks Approve/Reject, the route returns
 * 403 and the Hebrew error (he.social.errors.notOwner) is shown inline, the
 * same way any other failed action here is shown.
 *
 * On success, each action calls `router.refresh()` so the Server Component
 * page re-reads `proposedSocials`/`socials` (Approve) or the rejected-rows
 * read that feeds the editor's rejection notice (Reject) — this component
 * itself never holds the source of truth, it only triggers the same
 * Server-Component re-fetch every other admin action in this codebase
 * already uses (see StartEditingButton.jsx).
 *
 * Props:
 *   - talentId (string, optional) — the Talent id. Required for the new
 *     Approve/Reject actions to have somewhere to POST to; when absent
 *     (e.g. a future isolated/storybook-style render), the actions row is
 *     simply not rendered and this falls back to the original read-only
 *     behavior.
 *   - publishedSocials (TalentSocial[], optional, default []) — current
 *     Published+Active rows (same shape as SocialLinksEditor's
 *     `publishedSocials`).
 *   - proposedSocials (TalentSocial[], optional, default []) — current
 *     PROPOSED rows for this talent (talentAdapter.getProposedSocials).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./SocialLinksOwnerReview.module.css";
import StatusBadge from "./StatusBadge";
import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";
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

/*
 * Owner Approve/Reject (Social Links) sprint — the new actions row for one
 * review item. Owns its own small bit of local state (idle / confirming a
 * rejection note / submitting / done / error) — nothing here is lifted to
 * the parent panel, since each card's action is independent of every other
 * card's.
 */
function ReviewItemActions({ talentId, socialId }) {
  const router = useRouter();
  const [mode, setMode] = useState("idle"); // idle | confirmingReject | done
  const [status, setStatus] = useState("idle"); // idle | submitting | error
  const [error, setError] = useState(null);
  const [note, setNote] = useState("");
  const [doneAction, setDoneAction] = useState(null); // "approved" | "rejected"

  const actionsCopy = he.social.review.actions;

  async function handleApprove() {
    setStatus("submitting");
    setError(null);

    try {
      const response = await fetch(`/api/admin/talent/${talentId}/socials/${socialId}/approve`, {
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || actionsCopy.genericError);
      }

      setStatus("idle");
      setMode("done");
      setDoneAction("approved");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setError(err?.message || actionsCopy.genericError);
    }
  }

  async function handleConfirmReject() {
    if (!note.trim()) {
      setStatus("error");
      setError(he.social.errors.rejectionNoteRequired);
      return;
    }

    setStatus("submitting");
    setError(null);

    try {
      const response = await fetch(`/api/admin/talent/${talentId}/socials/${socialId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionNote: note.trim() }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || actionsCopy.genericError);
      }

      setStatus("idle");
      setMode("done");
      setDoneAction("rejected");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setError(err?.message || actionsCopy.genericError);
    }
  }

  if (mode === "done") {
    return (
      <p className={styles.actionDoneNote} role="status">
        {doneAction === "approved" ? actionsCopy.approved : actionsCopy.rejected}
      </p>
    );
  }

  if (mode === "confirmingReject") {
    return (
      <div className={styles.rejectForm}>
        <label className={styles.rejectNoteLabel} htmlFor={`reject-note-${socialId}`}>
          {actionsCopy.rejectionNoteLabel}
        </label>
        <textarea
          id={`reject-note-${socialId}`}
          className={styles.rejectNoteTextarea}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={actionsCopy.rejectionNotePlaceholder}
          rows={3}
          disabled={status === "submitting"}
        />
        {status === "error" && error ? (
          <p className={styles.actionError} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.actionsRow}>
          <SecondaryButton
            onClick={() => {
              setMode("idle");
              setStatus("idle");
              setError(null);
            }}
            disabled={status === "submitting"}
          >
            {actionsCopy.cancel}
          </SecondaryButton>
          <PrimaryButton onClick={handleConfirmReject} disabled={status === "submitting"}>
            {status === "submitting" ? actionsCopy.rejecting : actionsCopy.confirmReject}
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.actionsRow}>
      {status === "error" && error ? (
        <p className={styles.actionError} role="alert">
          {error}
        </p>
      ) : null}
      <SecondaryButton onClick={() => setMode("confirmingReject")} disabled={status === "submitting"}>
        {actionsCopy.requestChanges}
      </SecondaryButton>
      <PrimaryButton onClick={handleApprove} disabled={status === "submitting"}>
        {status === "submitting" ? actionsCopy.approving : actionsCopy.approve}
      </PrimaryButton>
    </div>
  );
}

function ReviewItemCard({ item, talentId }) {
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

      {proposed && talentId ? <ReviewItemActions talentId={talentId} socialId={proposed.id} /> : null}
    </div>
  );
}

export default function SocialLinksOwnerReview({ talentId = null, publishedSocials = [], proposedSocials = [] }) {
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
          <ReviewItemCard key={item.key} item={item} talentId={talentId} />
        ))}
      </div>

      {hasRemovedItems ? <p className={styles.limitationNote}>{he.social.review.removalLimitationNote}</p> : null}

      <p className={styles.pendingNote} role="note">
        {he.social.review.pendingNote}
      </p>
    </div>
  );
}
