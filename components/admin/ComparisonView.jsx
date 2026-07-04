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
 *
 * Talent Detail UX Refactor, Phase 1 — collapsed from the old simultaneous
 * "Current Published" + "Proposed Update" two-column layout into a single
 * section that switches between a read-only view and an editable view.
 * Purely a rendering change: every piece of state/logic above this comment
 * (proposedValues/savedValues, isDirty, save/submit/publish handlers, the
 * beforeunload guard, the post-refresh resync effect) is unchanged.
 *
 * `isEditing` is derived from `Boolean(onSaveDraft)` rather than a new prop:
 * TalentDetailsEditor already only passes `onSaveDraft` when the caller
 * resolved an editable DRAFT/PROPOSED version (`versionId` truthy), so this
 * is the same signal the old proposed column's "disabled inputs" state used
 * — just read as a real mode switch instead. When `isEditing` is false, the
 * section renders every field as plain read-only text (the exact same
 * `formatReadOnlyValue` this file already used for the old published
 * column). When `isEditing` is true, it renders the exact same `ProposedField`
 * inputs the old proposed column used, seeded from `proposedValues` exactly
 * as before — including falling back to a real `draftValue` when one was
 * already saved, so resuming an existing Draft/Proposed shows its values,
 * not the published ones. There is no separate "Current Published" or
 * "Proposed Update" copy anywhere in this mode; that comparison framing is
 * intentionally left to GalleryOwnerReview/SocialLinksOwnerReview-style
 * review surfaces, which this component still does not render.
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

  // Talent Detail Foundation sprint — "number" type (sortOrder/
  // featuredOrder): a plain nullable integer, displayed as-is or "—" when
  // unset, same fallback convention every other optional field here
  // already uses.
  if (type === "number") {
    return value === null || value === undefined || value === "" ? "—" : String(value);
  }

  // "computed" fields (currently just age, derived from birthDate) are
  // never stored/editable — the caller passes the already-computed value
  // and this just falls through to the plain display below.

  // Talent Visibility sprint (admin UI) — "visibility" reads as a plain
  // VISIBLE/HIDDEN label (he.talent.fields.visibilityVisible/Hidden), same
  // read-only-in-both-columns treatment as "computed" below. The actual
  // value change happens via the header's Hide/Restore action, never via
  // this row, so there is no input for it even in the proposed column.
  if (type === "visibility") {
    return value === "HIDDEN" ? he.talent.fields.visibilityHidden : he.talent.fields.visibilityVisible;
  }

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

  // Talent Detail Foundation sprint — "number" type (sortOrder/
  // featuredOrder). Plain native number input; empty string maps to `null`
  // on change, same nullable-clearing convention the "date" field above
  // already uses, rather than coercing an emptied field to 0.
  if (type === "number") {
    return (
      <input
        id={`proposed-${key}`}
        type="number"
        className={styles.input}
        value={value === null || value === undefined ? "" : value}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
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

  // Talent Visibility sprint (admin UI) — same "no input control, ever"
  // treatment as "computed" above, for the same reason: this row exists so
  // the Proposed column shows what visibility *would* be if this draft is
  // published, not so the field can be edited by typing here. The real
  // mutation path is the header's Hide/Restore action (which itself just
  // PATCHes this same draft's `visibility` field) — keeping this row
  // read-only avoids a second, competing way to change the same value.
  if (type === "visibility") {
    return (
      <span className={styles.readOnlyValue}>
        {value === "HIDDEN" ? he.talent.fields.visibilityHidden : he.talent.fields.visibilityVisible}
      </span>
    );
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

export default function ComparisonView({ fields, groups, onSaveDraft, onSubmit, onPublish, isProposed = false, showSubmit = true }) {
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
  // Owner Direct Publish UX sprint — own status, independent of saveStatus/
  // submitStatus: Publish Now is a third, separate action (not a relabeled
  // Submit), so it gets its own in-flight/result tracking.
  const [publishStatus, setPublishStatus] = useState("idle"); // idle | publishing | published | error
  const [publishError, setPublishError] = useState(null);

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
  // Owner Direct Publish UX sprint — unlike Submit, Publish Now is NOT
  // forced off by `isProposed`: an Owner publishing a version that's
  // already PROPOSED (e.g. one an Employee submitted) is exactly the normal
  // case this button exists for. Still requires `!isDirty` for the same
  // reason Submit does (see that prop's header comment) — Publish Now acts
  // on the already-persisted row, not on unsaved local edits.
  const publishing = publishStatus === "publishing";
  const publishDisabled = !onPublish || isDirty || saving || submitting || publishing;

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
  const publishDisabledReason = !onPublish
    ? he.editor.publish.disabledNoVersion
    : isDirty
      ? he.editor.publish.unsavedHint
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
    if (publishStatus !== "idle" && publishStatus !== "publishing") {
      setPublishStatus("idle");
      setPublishError(null);
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

  // Owner Direct Publish UX sprint — the only place this component talks to
  // its caller about publishing. Same "no fetch/URL/talent-specific logic
  // here" rule as handleSaveDraft/handleSubmit above: the caller's
  // `onPublish` callback owns the actual API call (and any approve/submit
  // composition it needs server-side); this function just calls it and
  // reacts to the outcome.
  async function handlePublishNow() {
    if (!onPublish || publishDisabled) return;

    setPublishStatus("publishing");
    setPublishError(null);

    try {
      await onPublish();
      setPublishStatus("published");
    } catch (error) {
      setPublishStatus("error");
      setPublishError(error?.message || he.editor.publish.error);
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

  // Implementation Sprint A, Phase 1 — state synchronization after Publish
  // (and, for free, after any other server-refreshing action: Submit,
  // Approve, Reject, etc.). This component never remounts across a
  // `router.refresh()` triggered by TalentDetailsEditor's handleSubmit/
  // handlePublishNow — it's the same component instance, so `useState`'s
  // lazy initializer (buildInitialValues, used to seed proposedValues/
  // savedValues above) only ever runs once, on first mount. Without this
  // effect, a successful Publish leaves proposedValues/savedValues frozen
  // on whatever was true *before* the publish, even though the parent has
  // already re-rendered this component with fresh `fields`/`groups` props
  // reflecting the new Current Published values — the literal "stuck in
  // Draft" bug this phase exists to fix (spec Section 2.7/8).
  //
  // Guarded by `!isDirty`, the same condition ProfileImagePanel's analogous
  // sync effect already uses: Publish (and Submit) are only ever clickable
  // when the proposed values are clean (not dirty), so by the time a
  // publish/submit actually succeeds and the parent's props change,
  // proposedValues already equals savedValues — resyncing both to the
  // fresh server data can never clobber an in-progress, unsaved edit.
  // `initialValuesKey` is a content-based (not reference-based) dependency
  // so this only actually fires when the underlying field values change,
  // not on every unrelated re-render.
  const initialValuesKey = JSON.stringify(buildInitialValues());
  useEffect(() => {
    if (!isDirty) {
      const refreshed = JSON.parse(initialValuesKey);
      setProposedValues(refreshed);
      setSavedValues(refreshed);
      setSaveStatus("idle");
      setSaveError(null);
      setSubmitStatus("idle");
      setSubmitError(null);
      setPublishStatus("idle");
      setPublishError(null);
      setConflictNotice(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValuesKey]);

  // Talent Detail UX Refactor, Phase 1 — one section, one mode at a time.
  // See this component's header comment for why `Boolean(onSaveDraft)` is
  // the right signal: it's exactly the same "is there an editable
  // DRAFT/PROPOSED version" state TalentDetailsEditor already derives.
  const isEditing = Boolean(onSaveDraft);
  const sectionLabel = isEditing ? he.editor.sectionEditingLabel : he.editor.sectionViewLabel;

  return (
    <div className={styles.tokens}>
      <section
        className={isEditing ? styles.proposedSection : styles.publishedSection}
        aria-label={sectionLabel}
      >
        <header className={styles.eyebrow}>
          <span className={styles.eyebrowIcon} aria-hidden="true">
            {isEditing ? "✏️" : "🌍"}
          </span>
          <span className={isEditing ? styles.eyebrowTitleProposed : styles.eyebrowTitle}>
            {sectionLabel}
          </span>
        </header>
        <p className={isEditing ? styles.proposedSubtitle : styles.publishedSubtitle}>
          {isEditing ? he.editor.sectionEditingSubtitle : he.editor.sectionViewSubtitle}
        </p>

        <div className={styles.groupedFieldList}>
          {fieldGroups.map((group) => (
            <div key={group.key} className={styles.fieldGroup}>
              {group.label ? (
                <h3 className={isEditing ? styles.groupLabelProposed : styles.groupLabel}>{group.label}</h3>
              ) : null}
              <div className={styles.fieldList}>
                {group.fields.map((field) =>
                  isEditing ? (
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
                  ) : (
                    <div key={field.key} className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>{field.label}</span>
                      <span className={styles.readOnlyValue}>{formatReadOnlyValue(field)}</span>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

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
        showSubmit={showSubmit}
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
        onPublish={handlePublishNow}
        showPublish={!!onPublish}
        publishDisabled={publishDisabled}
        publishDisabledReason={publishDisabledReason}
        publishStatus={publishStatus}
        publishStatusMessage={
          publishStatus === "error"
            ? publishError
            : onPublish && isDirty && publishStatus === "idle"
              ? he.editor.publish.unsavedHint
              : undefined
        }
      />
    </div>
  );
}
