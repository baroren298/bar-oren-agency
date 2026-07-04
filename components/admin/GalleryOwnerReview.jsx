"use client";

/*
 * GalleryOwnerReview — Gallery Sprint 1.
 *
 * Direct port of SocialLinksOwnerReview.jsx for TalentGalleryImage rows:
 * a read-only panel showing exactly what a submitted Gallery proposal
 * (TalentGalleryImage rows with versionStatus = PROPOSED) would change,
 * plus the same real Approve/Reject actions
 * (POST .../gallery/[imageId]/approve, POST .../gallery/[imageId]/reject)
 * SocialLinksOwnerReview already has for Social Links. The diff/matching
 * logic lives in lib/admin/gallery-review.js (buildGalleryReviewItems/
 * summarizeGalleryReview), the exact sibling of social-review.js.
 *
 * Both actions are Owner-only at the API layer (requireOwner) — this
 * component does not attempt its own role gating; a non-Owner session
 * gets a 403 + Hebrew error (he.gallery.errors.notOwner), shown inline
 * exactly like any other failed action here.
 *
 * On success, each action calls `router.refresh()` so the Server
 * Component page re-reads `proposedGalleryImages`/`galleryImages`
 * (Approve) or the rejected-rows read that feeds
 * MediaGalleryEditor's rejection notice (Reject) — this component never
 * holds the source of truth, only triggers the same Server-Component
 * re-fetch every other admin action in this codebase already uses.
 *
 * Props:
 *   - talentId (string, optional) — required for the Approve/Reject
 *     actions to have somewhere to POST to; when absent the actions row is
 *     simply not rendered.
 *   - publishedImages (TalentGalleryImage[], optional, default []) —
 *     current Published+Active rows (same shape as MediaGalleryEditor's
 *     `publishedImages`).
 *   - proposedImages (TalentGalleryImage[], optional, default []) —
 *     current PROPOSED rows for this talent
 *     (talentAdapter.getProposedGalleryImages).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./GalleryOwnerReview.module.css";
import StatusBadge from "./StatusBadge";
import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";
import { he } from "@/lib/admin/i18n/he";
import {
  buildGalleryReviewItems,
  summarizeGalleryReview,
  GALLERY_REVIEW_STATUS,
} from "@/lib/admin/gallery-review";

const STATUS_TONE = {
  [GALLERY_REVIEW_STATUS.ADDED]: "success",
  [GALLERY_REVIEW_STATUS.CHANGED]: "warning",
  [GALLERY_REVIEW_STATUS.UNCHANGED]: "neutral",
  [GALLERY_REVIEW_STATUS.UNCHANGED_PUBLISHED_ONLY]: "neutral",
  [GALLERY_REVIEW_STATUS.REMOVED]: "danger",
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

function ImageFieldsReadOnly({ image, changedFields = [] }) {
  if (!image) {
    return <p className={styles.noImageNote}>{he.gallery.review.noCurrentImage}</p>;
  }

  const fields = he.gallery.fields;

  return (
    <div className={styles.imageFields}>
      {image.src ? (
        <div className={styles.thumbnailWrapper}>
          <Image src={image.src} alt={image.alt || ""} fill sizes="200px" className={styles.thumbnail} />
        </div>
      ) : null}

      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>{fields.altHe}</span>
        <span
          className={
            fieldChanged(changedFields, "altHe")
              ? styles.valueChanged
              : image.altHe
                ? styles.value
                : styles.emptyValue
          }
        >
          {image.altHe || he.social.notSet}
        </span>
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>{fields.altEn}</span>
        <span
          className={
            fieldChanged(changedFields, "altEn")
              ? styles.valueChanged
              : image.altEn
                ? styles.value
                : styles.emptyValue
          }
        >
          {image.altEn || he.social.notSet}
        </span>
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>{fields.position}</span>
        <span
          className={
            fieldChanged(changedFields, "position")
              ? styles.valueChanged
              : image.position
                ? styles.value
                : styles.emptyValue
          }
        >
          {image.position || he.social.notSet}
        </span>
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>{fields.scale}</span>
        <span
          className={
            fieldChanged(changedFields, "scale")
              ? styles.valueChanged
              : image.scale != null
                ? styles.value
                : styles.emptyValue
          }
        >
          {image.scale != null ? image.scale : he.social.notSet}
        </span>
      </div>

      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>{fields.mobileOrder}</span>
        <span
          className={
            fieldChanged(changedFields, "mobileOrder")
              ? styles.valueChanged
              : image.mobileOrder != null
                ? styles.value
                : styles.emptyValue
          }
        >
          {image.mobileOrder != null ? image.mobileOrder : he.social.notSet}
        </span>
      </div>
    </div>
  );
}

/*
 * Gallery Sprint 1 — the actions row for one review item, ported 1:1 from
 * SocialLinksOwnerReview's ReviewItemActions, only the endpoint paths and
 * copy namespace (he.gallery.* instead of he.social.*) differ.
 */
function ReviewItemActions({ talentId, imageId }) {
  const router = useRouter();
  const [mode, setMode] = useState("idle"); // idle | confirmingReject | done
  const [status, setStatus] = useState("idle"); // idle | submitting | error
  const [error, setError] = useState(null);
  const [note, setNote] = useState("");
  const [doneAction, setDoneAction] = useState(null); // "approved" | "rejected"

  const actionsCopy = he.gallery.review.actions;

  async function handleApprove() {
    setStatus("submitting");
    setError(null);

    try {
      const response = await fetch(`/api/admin/talent/${talentId}/gallery/${imageId}/approve`, {
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
      setError(he.gallery.errors.rejectionNoteRequired);
      return;
    }

    setStatus("submitting");
    setError(null);

    try {
      const response = await fetch(`/api/admin/talent/${talentId}/gallery/${imageId}/reject`, {
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
        <label className={styles.rejectNoteLabel} htmlFor={`reject-note-${imageId}`}>
          {actionsCopy.rejectionNoteLabel}
        </label>
        <textarea
          id={`reject-note-${imageId}`}
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
  const statusLabel = he.gallery.review.status[status] || status;
  const tone = STATUS_TONE[status] || "neutral";
  const proposedAt = formatHebrewDate(proposed?.createdAt);
  const proposedByEmail = proposed?.createdBy?.email;

  return (
    <div className={styles.itemCard}>
      <div className={styles.itemHeader}>
        <StatusBadge label={statusLabel} tone={tone} />
        {proposed && (proposedAt || proposedByEmail) ? (
          <span className={styles.itemMeta}>
            {proposedByEmail ? `${he.gallery.review.proposedBy} ${proposedByEmail}` : null}
            {proposedByEmail && proposedAt ? " · " : null}
            {proposedAt ? `${he.gallery.review.proposedAt} ${proposedAt}` : null}
          </span>
        ) : null}
      </div>

      <div className={styles.itemColumns}>
        <section className={styles.itemColumn} aria-label={he.gallery.review.currentColumnTitle}>
          <p className={styles.columnTitle}>{he.gallery.review.currentColumnTitle}</p>
          <ImageFieldsReadOnly image={published} />
        </section>

        {proposed ? (
          <section className={styles.itemColumnProposed} aria-label={he.gallery.review.proposedColumnTitle}>
            <p className={styles.columnTitleProposed}>{he.gallery.review.proposedColumnTitle}</p>
            <ImageFieldsReadOnly image={proposed} changedFields={changedFields} />
          </section>
        ) : null}
      </div>

      {proposed && talentId ? <ReviewItemActions talentId={talentId} imageId={proposed.id} /> : null}
    </div>
  );
}

export default function GalleryOwnerReview({ talentId = null, publishedImages = [], proposedImages = [] }) {
  if (!proposedImages || proposedImages.length === 0) {
    return null;
  }

  const items = buildGalleryReviewItems(publishedImages, proposedImages);
  const summary = summarizeGalleryReview(items);
  const hasRemovedItems = summary.removed > 0;

  return (
    <div className={styles.tokens}>
      <header className={styles.eyebrow}>
        <span className={styles.eyebrowIcon} aria-hidden="true">
          {he.gallery.review.eyebrowIcon}
        </span>
        <span className={styles.eyebrowTitle}>{he.gallery.review.title}</span>
      </header>
      <p className={styles.subtitle}>{he.gallery.review.subtitle}</p>

      <div className={styles.summaryRow}>
        {summary.added > 0 ? (
          <StatusBadge label={`${summary.added} ${he.gallery.review.summary.added}`} tone="success" />
        ) : null}
        {summary.changed > 0 ? (
          <StatusBadge label={`${summary.changed} ${he.gallery.review.summary.changed}`} tone="warning" />
        ) : null}
        {summary.removed > 0 ? (
          <StatusBadge label={`${summary.removed} ${he.gallery.review.summary.removed}`} tone="danger" />
        ) : null}
      </div>

      <div className={styles.itemList}>
        {items.map((item) => (
          <ReviewItemCard key={item.key} item={item} talentId={talentId} />
        ))}
      </div>

      {hasRemovedItems ? <p className={styles.limitationNote}>{he.gallery.review.removalLimitationNote}</p> : null}

      <p className={styles.pendingNote} role="note">
        {he.gallery.review.pendingNote}
      </p>
    </div>
  );
}
