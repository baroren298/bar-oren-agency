"use client";

/*
 * ConfirmDialog — Talent Visibility sprint (admin UI).
 *
 * Generic, entity-agnostic confirmation modal: a title, a body, and
 * Confirm/Cancel buttons. Created for this sprint's Hide/Restore action
 * (requirement #5: "show a confirmation dialog... reuse existing dialog
 * components if available") — a search of components/admin/** and the rest
 * of the codebase found no existing admin dialog/modal component to reuse
 * (only components/talent/TalentModal.jsx, a public-site component built
 * for a talent profile lightbox, not an admin confirmation affordance), so
 * this is a new small shared primitive rather than a one-off built into
 * TalentVisibilityAction.jsx. It knows nothing about talent, visibility, or
 * any other entity — same "stay generic so future sprints can reuse it"
 * principle ComparisonView/EditorActionBar/StatusBadge already follow.
 *
 * Deliberately plain: a fixed overlay + centered panel, native button
 * elements (PrimaryButton/SecondaryButton, the existing shared buttons),
 * Escape-to-cancel, click-outside-to-cancel. No animation library, no
 * portal — renders inline, which is fine since it's only ever mounted by a
 * small client component (TalentVisibilityAction) that already controls
 * when it's open.
 *
 * Props:
 *   - open (boolean, required)
 *   - title (string, required)
 *   - body (string, required)
 *   - confirmLabel (string, required)
 *   - cancelLabel (string, required)
 *   - onConfirm (function, required)
 *   - onCancel (function, required)
 *   - confirming (boolean, optional, default false) — disables both buttons
 *     and swaps the confirm button's label while the caller's async action
 *     is in flight, same "disable while in-flight" convention
 *     EditorActionBar/StartEditingButton already use.
 *   - confirmingLabel (string, optional) — label shown on the confirm
 *     button while `confirming` is true
 *   - error (string, optional) — inline error text shown above the actions
 */

import { useEffect } from "react";
import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";
import styles from "./ConfirmDialog.module.css";

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirming = false,
  confirmingLabel,
  error,
}) {
  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape" && !confirming) {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, confirming, onCancel]);

  if (!open) return null;

  return (
    <div
      className={`${styles.tokens} ${styles.overlay}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !confirming) onCancel();
      }}
    >
      <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <h2 id="confirm-dialog-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.body}>{body}</p>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.actions}>
          <SecondaryButton type="button" onClick={onCancel} disabled={confirming}>
            {cancelLabel}
          </SecondaryButton>
          <PrimaryButton type="button" onClick={onConfirm} disabled={confirming}>
            {confirming ? confirmingLabel || confirmLabel : confirmLabel}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
