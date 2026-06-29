"use client";

/*
 * TalentVisibilityAction — Talent Visibility sprint (admin UI).
 *
 * The header's "Hide from Public Site" / "Restore Visibility" action
 * (requirement #2). Same client-wrapper shape as StartEditingButton.jsx /
 * CancelEditingButton.jsx: holds its own loading/error state, calls the
 * *existing* proposals REST routes via fetch, then lets the Server
 * Component page re-fetch via router.refresh() — no client-side DB/engine
 * access of any kind, and no new API route. This is the whole point of this
 * component: it reuses the Draft -> Submit -> Approve -> Publish engine
 * exactly as-is (talentRepository.updateTalentVersionFields's
 * WRITABLE_COLUMNS allowlist already includes 'visibility' — see Phase 1),
 * rather than inventing a second, visibility-specific workflow.
 *
 * What clicking it actually does (never publishes by itself, for either
 * role):
 *   1. If there is no editable DRAFT/PROPOSED version yet, POST
 *      .../proposals to create one (seeded from the current Published
 *      version, including its current visibility — see
 *      talent-workspace.js's extractTalentVersionFields).
 *   2. PATCH .../proposals/[versionId] with `{ fields: { visibility } }` —
 *      a targeted partial update that only touches the visibility column,
 *      identical in mechanism to any other single-field edit a user could
 *      make in the Details tab's ComparisonView.
 *   3. router.refresh() — the page re-derives pendingVersion/
 *      publishedVersion, which flips the header chip, this button's own
 *      label, and the Details tab's new visibility comparison row, all from
 *      the same `currentVisibility` the page already computed
 *      (deriveCurrentVisibility).
 *
 * From there it behaves exactly like editing any other field: the change
 * sits in the Draft until Save Draft/Submit/Approve/Publish (or, for an
 * Owner, the existing "Publish Now" shortcut on the Details tab) — this
 * component has no publish call of its own. The confirmation dialog's copy
 * (he.talent.detail.visibilityAction) is the only place Owner vs Employee
 * wording differs, to set accurate expectations about what happens next;
 * the underlying mutation above is identical for both roles.
 *
 * Props:
 *   - talentId (string, required)
 *   - role (string|null) — lib/admin/constants/enums ROLE, only used to
 *     pick which confirm-dialog body copy to show
 *   - currentVisibility ('VISIBLE'|'HIDDEN', required) — the same value the
 *     header's visibility chip renders (deriveCurrentVisibility), so the
 *     button's label/target always agrees with what the chip says
 *   - pendingVersionId (string|null) — the editable DRAFT/PROPOSED
 *     version's id, or null if none exists yet
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import SecondaryButton from "./SecondaryButton";
import ConfirmDialog from "./ConfirmDialog";
import { he } from "@/lib/admin/i18n/he";
import { ROLE, TALENT_VISIBILITY } from "@/lib/admin/constants/enums";
import styles from "./StartEditingButton.module.css";

const COPY = he.talent.detail.visibilityAction;

export default function TalentVisibilityAction({
  talentId,
  role,
  currentVisibility,
  pendingVersionId,
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

  const isHidden = currentVisibility === TALENT_VISIBILITY.HIDDEN;
  const nextVisibility = isHidden ? TALENT_VISIBILITY.VISIBLE : TALENT_VISIBILITY.HIDDEN;
  const isOwner = role === ROLE.OWNER;

  const label = isHidden ? COPY.restoreLabel : COPY.hideLabel;
  const confirmingLabel = isHidden ? COPY.restoreLoading : COPY.hideLoading;
  const dialogTitle = isHidden ? COPY.confirmRestoreTitle : COPY.confirmHideTitle;
  const dialogBody = isHidden
    ? isOwner
      ? COPY.confirmRestoreBodyOwner
      : COPY.confirmRestoreBodyEmployee
    : isOwner
      ? COPY.confirmHideBodyOwner
      : COPY.confirmHideBodyEmployee;
  const confirmCta = isHidden ? COPY.confirmRestoreCta : COPY.confirmHideCta;

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
      let versionId = pendingVersionId;

      if (!versionId) {
        const createResponse = await fetch(`/api/admin/talent/${talentId}/proposals`, {
          method: "POST",
        });
        const createBody = await createResponse.json().catch(() => ({}));

        if (!createResponse.ok) {
          throw new Error(createBody.error || COPY.genericError);
        }

        versionId = createBody.version?.id;
        if (!versionId) {
          throw new Error(COPY.genericError);
        }
      }

      const patchResponse = await fetch(`/api/admin/talent/${talentId}/proposals/${versionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { visibility: nextVisibility } }),
      });
      const patchBody = await patchResponse.json().catch(() => ({}));

      if (!patchResponse.ok) {
        throw new Error(patchBody.error || COPY.genericError);
      }

      setDialogOpen(false);
      // Same reasoning as StartEditingButton/CancelEditingButton's
      // router.refresh(): the page's own pendingVersion/publishedVersion
      // reads need to re-run so the header chip, this button's label, and
      // the Details tab's visibility row all reflect the new Draft.
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
