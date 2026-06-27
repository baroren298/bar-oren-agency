/*
 * EditorActionBar — Profile Editor Foundation sprint.
 *
 * The bottom action row for an editing workspace: ביטול שינויים / שמור
 * כטיוטה / שלח לאישור. Reuses the existing PrimaryButton/SecondaryButton
 * (Admin Design System Foundation) rather than introducing new button
 * styles, per this sprint's "reuse existing admin components" goal.
 *
 * Deliberately UI-only, per this sprint's explicit scope (no backend, no
 * save logic, no API calls, no approval logic):
 *   - "ביטול שינויים" calls `onCancel`, which the caller may wire to a
 *     purely local action (ComparisonView resets its in-memory proposed
 *     values). It is the one button that's actually "live" today because
 *     resetting local state isn't persistence.
 *   - "שמור כטיוטה" and "שלח לאישור" are disabled by default. They are
 *     left disabled rather than wired to silent no-ops on purpose: a
 *     button that does nothing when clicked is confusing ("did that
 *     work?"), whereas a disabled button with a tooltip reads honestly as
 *     "not built yet." A future sprint flips `*Disabled` to false once
 *     real draft-saving / approval-submission exists — no layout or prop
 *     changes needed here.
 *
 * Props:
 *   - onCancel (function, optional)
 *   - onSaveDraft (function, optional) — inert while saveDraftDisabled
 *   - onSubmit (function, optional) — inert while submitDisabled
 *   - saveDraftDisabled (boolean, optional, default true)
 *   - submitDisabled (boolean, optional, default true)
 *   - saveDraftStatus ("idle" | "saving" | "saved" | "error", optional,
 *     default "idle") — Save Draft sprint addition. Purely a label slot
 *     next to the button; this component still makes no decision about
 *     *when* each status applies, the caller (ComparisonView) owns that.
 *   - saveDraftStatusMessage (string, optional) — overrides the default
 *     copy for the current saveDraftStatus, used for the "error" state's
 *     specific error message, and (per the "Editable PROPOSED" sprint) for
 *     a PROPOSED-specific "saved" message.
 *   - saveDraftLabel (string, optional, default he.editor.actions.saveDraft)
 *     — "Editable PROPOSED" sprint addition. The button's own label is now
 *     swappable so the caller can show "עדכן הצעה" instead of "שמור כטיוטה"
 *     while editing an already-PROPOSED version, without this component
 *     needing to know what a "PROPOSED version" is.
 *   - submitStatus ("idle" | "submitting" | "submitted" | "error",
 *     optional, default "idle") — Submit for Approval sprint (Sprint 1)
 *     addition, same role as saveDraftStatus above but for the שלח לאישור
 *     button.
 *   - submitStatusMessage (string, optional) — overrides the default copy
 *     for the current submitStatus; also used (while submitStatus is
 *     "idle") to show the "save your draft first" hint when Submit is
 *     disabled because of unsaved local edits.
 */

import styles from "./EditorActionBar.module.css";
import SecondaryButton from "./SecondaryButton";
import PrimaryButton from "./PrimaryButton";
import { he } from "@/lib/admin/i18n/he";

const STATUS_COPY = {
  saving: he.editor.saveDraft.saving,
  saved: he.editor.saveDraft.saved,
  error: he.editor.saveDraft.error,
};

const SUBMIT_STATUS_COPY = {
  submitting: he.editor.submit.submitting,
  submitted: he.editor.submit.submitted,
  error: he.editor.submit.error,
};

export default function EditorActionBar({
  onCancel = () => {},
  onSaveDraft = () => {},
  onSubmit = () => {},
  saveDraftDisabled = true,
  submitDisabled = true,
  saveDraftStatus = "idle",
  saveDraftStatusMessage,
  saveDraftLabel = he.editor.actions.saveDraft,
  submitStatus = "idle",
  submitStatusMessage,
}) {
  const statusText = saveDraftStatus !== "idle" ? saveDraftStatusMessage || STATUS_COPY[saveDraftStatus] : null;
  const submitText =
    submitStatus !== "idle" ? submitStatusMessage || SUBMIT_STATUS_COPY[submitStatus] : submitStatusMessage;

  return (
    <div className={`${styles.tokens} ${styles.bar}`}>
      <SecondaryButton onClick={onCancel}>{he.editor.actions.cancel}</SecondaryButton>

      <div className={styles.primaryActions}>
        {statusText ? (
          <span
            className={saveDraftStatus === "error" ? styles.statusError : styles.statusText}
            role={saveDraftStatus === "error" ? "alert" : "status"}
          >
            {statusText}
          </span>
        ) : null}
        <SecondaryButton
          onClick={onSaveDraft}
          disabled={saveDraftDisabled}
          title={saveDraftDisabled ? he.editor.comingSoon : undefined}
        >
          {saveDraftLabel}
        </SecondaryButton>
        {submitText ? (
          <span
            className={submitStatus === "error" ? styles.statusError : styles.statusText}
            role={submitStatus === "error" ? "alert" : "status"}
          >
            {submitText}
          </span>
        ) : null}
        <PrimaryButton onClick={onSubmit} disabled={submitDisabled}>
          {he.editor.actions.submit}
        </PrimaryButton>
      </div>
    </div>
  );
}
