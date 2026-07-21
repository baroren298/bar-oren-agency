"use client";

/*
 * TalentArchiveAction — Talent Archive & Restore feature (final CMS v1
 * feature).
 *
 * The header's OWNER-only "Archive" / "Restore" action. Deliberately a
 * separate component from TalentVisibilityAction.jsx, not a variant of it:
 * visibility is a content field that rides the normal Draft -> Submit ->
 * Approve -> Publish workflow (PATCHes a version's `visibility` field);
 * archive/restore is a direct entity-lifecycle status change
 * (Talent.status) that takes effect immediately on confirm, with no
 * Draft/Submit/Approve step and no publish — the same distinction
 * ClientDetailClient.jsx already draws between client editing and client
 * archiving.
 *
 * What clicking it does: one POST to
 * /api/admin/talent/[id]/archive or /api/admin/talent/[id]/restore, then
 * router.refresh() so the page re-derives `talent.status` (which flips this
 * button's own label/target, the header badge, and whether the rest of the
 * page renders as read-only) — same "own loading/error state, then
 * router.refresh()" shape as every other header action here
 * (StartEditingButton/CancelEditingButton/TalentVisibilityAction).
 *
 * Both routes independently re-check OWNER server-side
 * (requireOwner + talentArchiveService.assertActorIsOwner); this
 * component's `role` prop only controls whether the button renders at all,
 * never the actual security boundary — same convention
 * ClientDetailClient.jsx documents ("Archive buttons are hidden for
 * EMPLOYEE — visibility only").
 *
 * Props:
 *   - talentId (string, required)
 *   - role (string|null) — only OWNER ever sees this button; the caller is
 *     expected to not render it for any other role, but this component
 *     also refuses to render for a non-OWNER role as a second guard.
 *   - archived (boolean, required) — talent.status === LIFECYCLE_STATUS.ARCHIVED
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import SecondaryButton from "./SecondaryButton";
import ConfirmDialog from "./ConfirmDialog";
import { he } from "@/lib/admin/i18n/he";
import { ROLE } from "@/lib/admin/constants/enums";
import styles from "./StartEditingButton.module.css";

const COPY = he.talent.detail.archiveAction;

export default function TalentArchiveAction({ talentId, role, archived }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

  if (role !== ROLE.OWNER) return null;

  const label = archived ? COPY.restoreLabel : COPY.archiveLabel;
  const confirmingLabel = archived ? COPY.restoreLoading : COPY.archiveLoading;
  const dialogTitle = archived ? COPY.confirmRestoreTitle : COPY.confirmArchiveTitle;
  const dialogBody = archived ? COPY.confirmRestoreBody : COPY.confirmArchiveBody;
  const confirmCta = archived ? COPY.confirmRestoreCta : COPY.confirmArchiveCta;
  const endpoint = `/api/admin/talent/${talentId}/${archived ? "restore" : "archive"}`;

  function openDialog() {
    setError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (confirming) return;
    setDialogOpen(false);
  }

  async function handleConfirm() {
    setConfirming(true);
    setError(null);

    try {
      const response = await fetch(endpoint, { method: "POST" });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || COPY.genericError);
      }

      setDialogOpen(false);
      router.refresh();
    } catch (err) {
      setError(err?.message || COPY.genericError);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <SecondaryButton type="button" onClick={openDialog}>
        {label}
      </SecondaryButton>

      <ConfirmDialog
        open={dialogOpen}
        title={dialogTitle}
        body={dialogBody}
        confirmLabel={confirmCta}
        cancelLabel={COPY.confirmCancel}
        onConfirm={handleConfirm}
        onCancel={closeDialog}
        confirming={confirming}
        confirmingLabel={confirmingLabel}
        error={error}
      />
    </div>
  );
}
