"use client";

/*
 * StartEditingButton — "Start Editing" sprint.
 *
 * The one and only place this codebase creates a Draft TalentVersion as a
 * client-triggered action — never as a side effect of rendering. Mirrors
 * the existing AdminLogoutButton.jsx pattern exactly: a small "use client"
 * wrapper holding loading state, calling a REST API route via fetch, then
 * letting the Server Component page re-fetch via router.refresh() (no
 * client-side DB/engine access of any kind).
 *
 * Three states, driven entirely by `pendingStatus` (whatever the page
 * already derived from versionService.getCurrentDraftOrProposed — this
 * component makes no engine calls of its own to figure that out):
 *   - pendingStatus == null    -> "Start Editing": POST creates a new Draft
 *   - pendingStatus == "DRAFT" -> "Continue Editing": POST is idempotent and
 *     just returns the existing Draft (see the route's own behavior) —
 *     clicking it again is harmless, it never creates a second Draft
 *   - pendingStatus == "PROPOSED" -> disabled, explanatory state; no POST is
 *     ever sent, so this never has a chance to create a competing Draft
 *
 * Props:
 *   - talentId (string, required)
 *   - pendingStatus (string|null) — "DRAFT", "PROPOSED", or null/undefined
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import PrimaryButton from "./PrimaryButton";
import { he } from "@/lib/admin/i18n/he";
import styles from "./StartEditingButton.module.css";

const COPY = he.talent.detail.startEditing;

export default function StartEditingButton({ talentId, pendingStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (pendingStatus === "PROPOSED") {
    return (
      <span className={styles.blocked} title={COPY.proposedBlockedHint}>
        {COPY.proposedBlockedLabel}
      </span>
    );
  }

  const isContinue = pendingStatus === "DRAFT";

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/talent/${talentId}/proposals`, {
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error || COPY.genericError);
        return;
      }

      router.refresh();
    } catch {
      setError(COPY.genericError);
    } finally {
      setLoading(false);
    }
  }

  const label = isContinue ? COPY.continueLabel : COPY.startLabel;
  const loadingLabel = isContinue ? COPY.continueLoading : COPY.startLoading;

  return (
    <div className={styles.wrapper}>
      <PrimaryButton type="button" onClick={handleClick} disabled={loading}>
        {loading ? loadingLabel : label}
      </PrimaryButton>
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
