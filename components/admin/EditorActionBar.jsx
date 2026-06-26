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
 */

import styles from "./EditorActionBar.module.css";
import SecondaryButton from "./SecondaryButton";
import PrimaryButton from "./PrimaryButton";
import { he } from "@/lib/admin/i18n/he";

export default function EditorActionBar({
  onCancel = () => {},
  onSaveDraft = () => {},
  onSubmit = () => {},
  saveDraftDisabled = true,
  submitDisabled = true,
}) {
  return (
    <div className={`${styles.tokens} ${styles.bar}`}>
      <SecondaryButton onClick={onCancel}>{he.editor.actions.cancel}</SecondaryButton>

      <div className={styles.primaryActions}>
        <SecondaryButton
          onClick={onSaveDraft}
          disabled={saveDraftDisabled}
          title={saveDraftDisabled ? he.editor.comingSoon : undefined}
        >
          {he.editor.actions.saveDraft}
        </SecondaryButton>
        <PrimaryButton
          onClick={onSubmit}
          disabled={submitDisabled}
          title={submitDisabled ? he.editor.comingSoon : undefined}
        >
          {he.editor.actions.submit}
        </PrimaryButton>
      </div>
    </div>
  );
}
