"use client";

/*
 * CancelEditingButton — Cancel Editing / Discard Draft sprint.
 *
 * Top-level "בטל עריכה" action shown next to <StartEditingButton> whenever
 * a DRAFT exists (page.jsx only renders this component when
 * `pendingStatus === "DRAFT"` — see that file's header usage). Deliberately
 * separate from the bottom form action bar's own "Cancel" button
 * (EditorActionBar's onCancel, which only resets in-memory unsaved field
 * edits) — this button ends the whole editing session by deleting the Draft
 * row itself and returning to the Published version, which is the UX
 * decision this sprint locks in.
 *
 * Same client-wrapper shape as StartEditingButton.jsx: holds its own
 * loading/error state, calls a REST API route via fetch, then lets the
 * Server Component page re-fetch via router.refresh() — no client-side
 * DB/engine access of any kind.
 *
 * Visible to both OWNER and EMPLOYEE — discarding your own Draft is
 * symmetric across roles (the actual enforcement is server-side,
 * requireOwnerOrEmployee + proposalService.discard()'s DRAFT-only guard;
 * this component has no role check of its own, same pattern
 * StartEditingButton already uses).
 *
 * A PROPOSED version is explicitly out of scope — page.jsx never renders
 * this button for that status; Owner Reject remains the only way to
 * withdraw a submitted proposal.
 *
 * Props:
 *   - talentId (string, required)
 *   - versionId (string, required) — the DRAFT version's id
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import SecondaryButton from "./SecondaryButton";
import ConfirmDialog from "./ConfirmDialog";
import { he } from "@/lib/admin/i18n/he";
import styles from "./StartEditingButton.module.css";

const COPY = he.talent.detail.cancelEditing;

export default function CancelEditingButton({ talentId, versionId }) {
  const router = useRouter();
  // Pre-merge blocker fix sprint (QA finding #2): the button no longer
  // discards on click — it opens the shared <ConfirmDialog> (the same
  // component TalentVisibilityAction already uses), and only a confirmed
  // dialog runs the exact same POST .../discard as before. The dialog copy
  // is explicit that the whole Draft (saved edits included) is deleted.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function handleOpenConfirm() {
    setError(null);
    setConfirmOpen(true);
  }

  function handleCancelConfirm() {
    if (loading) return;
    setConfirmOpen(false);
    setError(null);
  }

  async function handleConfirmDiscard() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/talent/${talentId}/proposals/${versionId}/discard`,
        { method: "POST" }
      );
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Keep the dialog open so the error is shown in context; the user
        // can retry or back out with "המשך עריכה".
        setError(body.error || COPY.genericError);
        return;
      }

      setConfirmOpen(false);
      // Same reasoning as StartEditingButton's router.refresh(): a
      // successful discard deletes the Draft row, which the page's own
      // pendingVersion read needs to re-derive (pendingStatus flips back to
      // null afterward, returning the header to "Start Editing").
      router.refresh();
    } catch {
      setError(COPY.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <SecondaryButton type="button" onClick={handleOpenConfirm} disabled={loading}>
        {loading ? COPY.loading : COPY.label}
      </SecondaryButton>

      <ConfirmDialog
        open={confirmOpen}
        title={COPY.confirmTitle}
        body={COPY.confirmBody}
        confirmLabel={COPY.confirmLabel}
        cancelLabel={COPY.confirmCancelLabel}
        onConfirm={handleConfirmDiscard}
        onCancel={handleCancelConfirm}
        confirming={loading}
        confirmingLabel={COPY.loading}
        error={error}
      />
    </div>
  );
}
