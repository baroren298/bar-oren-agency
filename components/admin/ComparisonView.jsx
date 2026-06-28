"use client";

/*
 * ComparisonView — Editing Experience Foundation sprint, restyled by the
 * "Editing Experience UX Polish" follow-up sprint.
 *
 * The reusable foundation for the admin's core editing concept: an employee
 * never edits the live website directly. They always see what is currently
 * published, and separately shape a proposed update beneath it. This
 * component is the generic, content-agnostic implementation of that
 * Current Published → Proposed Update layout — it knows nothing about
 * talent, gallery, SEO, or any other entity, only about a list of fields.
 *
 * UX polish pass (this sprint) — architecture and props are unchanged, only
 * presentation:
 *   - The published block now reads as plain, calm information (no card,
 *     no input-like styling at all) — it should never look editable.
 *   - The proposed block is the only part that looks editable: it gets a
 *     soft tinted, elevated surface so it visually reads as "the
 *     workspace," with its own icon + reassuring copy ("nothing is
 *     published until approved").
 *   - The arrow divider between the two is gone — hierarchy now comes from
 *     spacing, an icon+eyebrow label per section, and the background
 *     contrast between "calm" and "active," not from a directional symbol.
 *   - Each proposed field row reserves a small, currently-inert dot before
 *     its label — a visual placeholder for a future "this field changed"
 *     indicator. It is purely decorative today: no diffing, no comparison
 *     against the published value, no state. Wiring it up to a real diff
 *     is later work; this sprint only prepares the visual language.
 *
 * Still strictly UI-only, per this sprint's scope:
 *   - No save/submit. Edits to the "proposed" column live in local React
 *     state only and are discarded on navigation/reload.
 *   - No diffing logic, no validation, no conflict detection.
 *   - No API calls, no business logic about what a field "means."
 *
 * The same component is meant to be reused for every other entity that
 * gets an editing experience later (gallery, SEO, social links, homepage,
 * about, contact, footer, ...) — callers just supply a different `fields`/
 * `groups` array. Each field is { key, label, value, type }, where `type`
 * is one of "text" | "textarea" | "list" | "boolean" ("list" =
 * comma-separated values, e.g. categories/tags).
 *
 * Draft Editing Foundation sprint addition: a field may now also carry a
 * `draftValue` — when present, the proposed column's *initial* state seeds
 * from that real, persisted Draft value instead of from the published
 * `value`. Omitting `draftValue` falls back to the exact previous behavior
 * (proposed starts from published), so this is purely additive — no
 * existing caller's behavior changes unless it opts in. Still no save/API
 * call here: once seeded, edits still live only in local React state, per
 * this component's existing scope below.
 *
 * Profile Editor Foundation sprint additions:
 *   - Fields can now be organized into named groups (e.g. "מידע בסיסי",
 *     "ביוגרפיה") via the new `groups` prop, so a real editor with many
 *     fields reads as a structured form instead of one long list. The
 *     flat `fields` prop still works unchanged (wrapped into a single,
 *     unlabeled group internally) so this is purely additive — no existing
 *     caller breaks.
 *   - The editor now ends with a gentle helper note (EditorHelperNote) and
 *     a bottom action bar (EditorActionBar: ביטול שינויים / שמור כטיוטה /
 *     שלח לאישור). Per this sprint's explicit scope, "ביטול שינויים" only
 *     resets the in-memory proposed values back to the published ones —
 *     still no API calls — and "שמור כטיוטה" / "שלח לאישור" are disabled
 *     placeholders. See EditorActionBar.jsx for why they're disabled
 *     rather than wired to no-ops: it should be obvious to the employee
 *     that nothing happened yet, not ambiguous.
 *
 * Props:
 *   - fields ({ key, label, value, type }[], optional) — flat list, legacy
 *   - groups ({ key, label, fields: { key, label, value, type }[] }[],
 *     optional) — grouped list, preferred for new callers. Exactly one of
 *     `fields`/`groups` should be supplied.
 *   - onSaveDraft (async function(values) => result, optional) — Save Draft
 *     sprint addition. Still no fetch/URL/talent-specific logic in this
 *     file (required safeguard #2): this component only ever calls the
 *     callback its caller supplied with the current proposed values, and
 *     interprets whatever that callback resolves/rejects with to drive its
 *     own saving/saved/error UI state. The page (or a thin wrapper
 *     component) owns the actual API call. When omitted, the Save Draft
 *     button stays disabled exactly like before this prop existed — purely
 *     additive, no existing caller's behavior changes.
 *   - onSubmit (async function() => result, optional) — Submit for Approval
 *     sprint (Sprint 1) addition. Same shape/role as `onSaveDraft` above,
 *     except it takes no arguments: Submit flips the *already-persisted*
 *     DRAFT row to PROPOSED server-side (proposalService.submit()) — it
 *     does not send the in-memory `proposedValues` at all. That's why
 *     Submit is disabled whenever there are unsaved local edits (see
 *     `isDirty` below): submitting would otherwise lock in whatever was
 *     last *saved*, silently discarding anything typed since, which would
 *     be a confusing, easy-to-miss data loss. When omitted, the Submit
 *     button stays disabled exactly like before this prop existed.
 *   - isProposed (boolean, optional, default false) — "Editable PROPOSED"
 *     sprint addition. Set by the caller when the version being edited is
 *     already PROPOSED rather than DRAFT. Purely a presentation switch:
 *     swaps the Save button's label to "עדכן הצעה" and its "saved"
 *     confirmation to a proposal-flavored message, and forces Submit off
 *     regardless of whatever `onSubmit` was passed (Submit stays
 *     DRAFT-only — resubmitting an already-PROPOSED version is not a thing
 *     this sprint builds). Does not change save behavior at all; the
 *     in-place field update is identical either way.
 *
 * Save Draft sprint additions:
 *   - Dirty-state tracking: the Save Draft button is enabled only once the
 *     proposed values differ from their initial seed, and only when
 *     `onSaveDraft` was supplied; it disables itself again immediately
 *     while a save is in flight.
 *   - A small, isolated `beforeunload` guard warns before leaving the page
 *     with unsaved changes. Deliberately scoped to this one case (per this
 *     sprint's explicit "don't overbuild tab-switch guards" instruction) —
 *     it does not try to intercept in-app tab switches, only an actual
 *     page unload/reload/close.
 *
 * Submit for Approval sprint (Sprint 1) addition:
 *   - The Submit button is enabled only when `onSubmit` was supplied (i.e.
 *     the page resolved an editable DRAFT) AND there are no unsaved local
 *     edits (`!isDirty`) AND nothing else is in flight. It is the server
 *     (proposalService.submit()'s DRAFT-only guard) that actually enforces
 *     "only DRAFT can be submitted" — this is just the UI reflecting the
 *     same state without an extra round trip, same pattern as Save Draft.
 *     On a successful submit, this component does not flip any local
 *     "now read-only" state itself — the caller (TalentDetailsEditor) is
 *     expected to refresh the page, which re-derives `onSaveDraft`/
 *     `onSubmit` as undefined once the version is no longer DRAFT,
 *     disabling both buttons the same way they're disabled today when no
 *     editable Draft exists at all.
 */

import { useEffect, useState } from "react";
import styles from "./ComparisonView.module.css";
import EditorHelperNote from "./EditorHelperNote";
import EditorActionBar from "./EditorActionBar";
import { he } from "@/lib/admin/i18n/he";
import { formatHebrewDate } from "@/lib/admin/talent-workspace";

function normalizeGroups({ groups, fields }) {
  if (groups && groups.length) return groups;
  if (fields && fields.length) return [{ key: "_ungrouped", label: null, fields }];
  return [];
}

function formatReadOnlyValue(field) {
  const { value, type } = field;

  if (type === "boolean") {
    return value ? "כן" : "לא";
  }

  // "Location & age" cleanup sprint — birthDate is a real, editable date
  // field; format it the same way the rest of the admin formats dates
  // rather than showing the raw ISO string.
  if (type === "date") {
    return value ? formatHebrewDate(value) : "—";
  }

  // "computed" fields (currently just age, derived from birthDate) are
  // never stored/editable — the caller passes the already-computed value
  // and this just falls through to the plain display below.

  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "—";
  }

  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function ProposedField({ field, value, onChange }) {
  const { type, key, label } = field;

  if (type === "boolean") {
    return (
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(event) => onChange(event.target.checked)}
          className={styles.checkbox}
        />
        <span>{value ? "כן" : "לא"}</span>
      </label>
    );
  }

  if (type === "textarea") {
    return (
      <textarea
        id={`proposed-${key}`}
        className={styles.textarea}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        aria-label={label}
      />
    );
  }

  if (type === "list") {
    const text = Array.isArray(value) ? value.join(", ") : value ?? "";
    return (
      <input
        id={`proposed-${key}`}
        type="text"
        className={styles.input}
        value={text}
        onChange={(event) =>
          onChange(
            event.target.value
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean)
          )
        }
        aria-label={label}
      />
    );
  }

  // "Location & age" cleanup sprint — first real "date" field (birthDate).
  // Plain native date input, same editable mechanism every other field on
  // this proposed column already has; <input type="date"> needs a
  // YYYY-MM-DD string, so normalize whatever Date/ISO-string shape the
  // value arrives in.
  if (type === "date") {
    const isoValue = value ? new Date(value).toISOString().slice(0, 10) : "";
    return (
      <input
        id={`proposed-${key}`}
        type="date"
        className={styles.input}
        value={isoValue}
        onChange={(event) => onChange(event.target.value || null)}
        aria-label={label}
      />
    );
  }

  // "computed" fields (currently just age) are derived, read-only, and
  // never stored — no input control at all, even in the proposed column,
  // so there is nothing here to accidentally save/submit. Uses the live
  // `value` prop (proposedValues[key], seeded from draftValue/value like
  // every other field) rather than re-deriving from field.value, so it
  // stays consistent with whatever was seeded.
  if (type === "computed") {
    return <span className={styles.readOnlyValue}>{value === null || value === undefined ? "—" : String(value)}</span>;
  }

  return (
    <input
      id={`proposed-${key}`}
      type="text"
      className={styles.input}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
    />
  );
}

export default function ComparisonView({ fields, groups, onSaveDraft, onSubmit, isProposed = false }) {
  const fieldGroups = normalizeGroups({ groups, fields });
  const allFields = fieldGroups.flatMap((group) => group.fields);

  function buildInitialValues() {
    return allFields.reduce((acc, field) => {
      acc[field.key] = field.draftValue !== undefined ? field.draftValue : field.value;
      return acc;
    }, {});
  }

  const [proposedValues, setProposedValues] = useState(buildInitialValues);
  const [savedValues, setSavedValues] = useState(buildInitialValues);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [saveError, setSaveError] = useState(null);
  const [conflictNotice, setConflictNotice] = useState(null);
  // Submit for Approval sprint (Sprint 1) — mirrors saveStatus/saveError
  // above, kept as its own state since saving a draft and submitting it are
  // independent actions that can each succeed/fail on their own.
  const [submitStatus, setSubmitStatus] = useState("idle"); // idle | submitting | submitted | error
  const [submitError, setSubmitError] = useState(null);

  const isDirty = JSON.stringify(proposedValues) !== JSON.stringify(savedValues);
  const saving = saveStatus === "saving";
  const submitting = submitStatus === "submitting";
  const saveDraftDisabled = !onSaveDraft || !isDirty || saving || submitting;
  // Disabled while dirty (required safeguard, see header comment above):
  // Submit acts on the already-persisted DRAFT row, not on unsaved local
  // edits, so it must not be clickable while the two have diverged.
  // "Editable PROPOSED" sprint: also force-disabled whenever `isProposed`,
  // regardless of whether the caller passed `onSubmit` — Submit is
  // DRAFT-only (proposalService.submit() still throws on PROPOSED) and this
  // is a defensive UI-side belt-and-suspenders on top of the caller
  // already being expected not to pass `onSubmit` for a PROPOSED version.
  const submitDisabled = !onSubmit || isDirty || saving || submitting || isProposed;

  const saveDraftLabel = isProposed ? he.editor.actions.updateProposal : he.editor.actions.saveDraft;
  const savedStatusMessage = isProposed ? he.editor.saveDraft.savedProposal : undefined;

  // Admin Talent Editor UX polish sprint — accurate, situation-specific
  // tooltips for *why* Save Draft / Submit are disabled, replacing the old
  // blanket "this will connect in a future sprint" tooltip that used to
  // show here even though both buttons are real and working on this
  // component (Details/Podcast tabs). `onSaveDraft`/`onSubmit` being absent
  // means the caller (TalentDetailsEditor) found no editable DRAFT/PROPOSED
  // version to act on at all — that's the one case genuinely worth telling
  // the employee "go start editing first" rather than "saving failed" or
  // nothing at all.
  const saveDraftDisabledReason = !onSaveDraft
    ? he.editor.saveDraft.disabledNoVersion
    : !isDirty
      ? he.editor.saveDraft.disabledNoChanges
      : undefined;
  const submitDisabledReason = isProposed
    ? he.editor.submit.disabledProposedLocked
    : !onSubmit
      ? he.editor.submit.disabledNoVersion
      : isDirty
        ? he.editor.submit.unsavedHint
        : undefined;

  function handleChange(key, value) {
    setProposedValues((previous) => ({ ...previous, [key]: value }));
    // Any further edit after a "saved"/"error" status is shown should clear
    // that stale status rather than leaving it stuck on screen.
    if (saveStatus !== "idle" && saveStatus !== "saving") {
      setSaveStatus("idle");
      setSaveError(null);
    }
    // Same for a stale "submitted"/"error" status — a fresh edit makes the
    // proposed values dirty again anyway (which already disables Submit),
    // but the leftover status text would otherwise read as misleadingly
    // current.
    if (submitStatus !== "idle" && submitStatus !== "submitting") {
      setSubmitStatus("idle");
      setSubmitError(null);
    }
  }

  // Local-only reset — per this sprint's scope, "ביטול שינויים" never talks
  // to a server. It just discards whatever the employee typed into the
  // proposed column and snaps it back to the published values in memory.
  function handleCancel() {
    setProposedValues(savedValues);
    setSaveStatus("idle");
    setSaveError(null);
  }

  // Save Draft sprint — the only place this component talks to its caller.
  // No fetch/URL/talent-specific logic here (required safeguard #2): the
  // caller's `onSaveDraft` callback owns the actual API call, this function
  // just calls it with the current proposed values and reacts to the
  // outcome. `onSaveDraft` is expected to resolve with
  // `{ version, conflict, validation }` (matching proposalService.update's
  // return shape) or throw/reject with an Error.
  async function handleSaveDraft() {
    if (!onSaveDraft || saving) return;

    setSaveStatus("saving");
    setSaveError(null);
    setConflictNotice(null);

    try {
      const result = await onSaveDraft(proposedValues);
      setSavedValues(proposedValues);
      setSaveStatus("saved");
      // Conflict info is non-blocking (required safeguard #6) — surfaced as
      // a calm, informational note, never as a reason the save failed.
      if (result?.conflict?.conflict) {
        setConflictNotice(he.editor.saveDraft.conflictNotice);
      }
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error?.message || he.editor.saveDraft.error);
    }
  }

  // Submit for Approval sprint (Sprint 1) — the only place this component
  // talks to its caller about submitting. No fetch/URL/talent-specific
  // logic here either (same required safeguard as handleSaveDraft above):
  // the caller's `onSubmit` callback owns the actual API call and any
  // page refresh; this function just calls it and reacts to the outcome.
  // Takes no arguments — Submit acts on the persisted DRAFT row server-side,
  // not on `proposedValues` (see header comment on the `onSubmit` prop).
  async function handleSubmit() {
    if (!onSubmit || submitDisabled) return;

    setSubmitStatus("submitting");
    setSubmitError(null);

    try {
      await onSubmit();
      setSubmitStatus("submitted");
    } catch (error) {
      setSubmitStatus("error");
      setSubmitError(error?.message || he.editor.submit.error);
    }
  }

  // Isolated `beforeunload` guard only — deliberately not a tab-switch
  // guard (out of scope this sprint, see header comment). Warns on an
  // actual page unload/reload/close while there are unsaved changes.
  useEffect(() => {
    function handleBeforeUnload(event) {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  return (
    <div className={styles.tokens}>
      <div className={styles.comparison}>
        <section className={styles.publishedSection} aria-label="גרסה מפורסמת">
          <header className={styles.eyebrow}>
            <span className={styles.eyebrowIcon} aria-hidden="true">
              🌍
            </span>
            <span className={styles.eyebrowTitle}>גרסה מפורסמת</span>
          </header>
          <p className={styles.publishedSubtitle}>כך הביקורים רואים את זה באתר כרגע.</p>

          <div className={styles.groupedFieldList}>
            {fieldGroups.map((group) => (
              <div key={group.key} className={styles.fieldGroup}>
                {group.label ? <h3 className={styles.groupLabel}>{group.label}</h3> : null}
                <div className={styles.fieldList}>
                  {group.fields.map((field) => (
                    <div key={field.key} className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>{field.label}</span>
                      <span className={styles.readOnlyValue}>{formatReadOnlyValue(field)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.proposedSection} aria-label="עדכון מוצע">
          <header className={styles.eyebrow}>
            <span className={styles.eyebrowIcon} aria-hidden="true">
              ✏️
            </span>
            <span className={styles.eyebrowTitleProposed}>עדכון מוצע</span>
          </header>
          <p className={styles.proposedSubtitle}>
            זו הגרסה שאתה מציע. שום דבר לא יתפרסם באתר לפני אישור.
          </p>

          <div className={styles.groupedFieldList}>
            {fieldGroups.map((group) => (
              <div key={group.key} className={styles.fieldGroup}>
                {group.label ? (
                  <h3 className={styles.groupLabelProposed}>{group.label}</h3>
                ) : null}
                <div className={styles.fieldList}>
                  {group.fields.map((field) => (
                    <div key={field.key} className={styles.fieldRowEditable}>
                      <label htmlFor={`proposed-${field.key}`} className={styles.proposedFieldLabel}>
                        {/*
                         * Inert placeholder for a future "this field was
                         * changed" indicator. Purely visual — no diffing
                         * against the published value happens here or
                         * anywhere in this component yet.
                         */}
                        <span className={styles.changeDot} aria-hidden="true" />
                        {field.label}
                      </label>
                      <ProposedField
                        field={field}
                        value={proposedValues[field.key]}
                        onChange={(value) => handleChange(field.key, value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <EditorHelperNote />
      {conflictNotice ? (
        <p className={styles.conflictNotice} role="status">
          {conflictNotice}
        </p>
      ) : null}
      <EditorActionBar
        onCancel={handleCancel}
        onSaveDraft={handleSaveDraft}
        saveDraftDisabled={saveDraftDisabled}
        saveDraftDisabledReason={saveDraftDisabledReason}
        saveDraftLabel={saveDraftLabel}
        saveDraftStatus={saveStatus}
        saveDraftStatusMessage={saveStatus === "error" ? saveError : saveStatus === "saved" ? savedStatusMessage : undefined}
        onSubmit={handleSubmit}
        submitDisabled={submitDisabled}
        submitDisabledReason={submitDisabledReason}
        submitStatus={submitStatus}
        submitStatusMessage={
          submitStatus === "error"
            ? submitError
            : onSubmit && isDirty && submitStatus === "idle"
              ? he.editor.submit.unsavedHint
              : undefined
        }
      />
    </div>
  );
}
