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
import { he } from "@/lib/admin/i18n/he";
import styles from "./StartEditingButton.module.css";

const COPY = he.talent.detail.cancelEditing;

export default function CancelEditingButton({ talentId, versionId }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/talent/${talentId}/proposals/${versionId}/discard`,
        { method: "POST" }
      );
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error || COPY.genericError);
        return;
      }

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
      <SecondaryButton type="button" onClick={handleClick} disabled={loading}>
        {loading ? COPY.loading : COPY.label}
      </SecondaryButton>
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
