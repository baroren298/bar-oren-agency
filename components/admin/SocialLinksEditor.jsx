"use client";

/*
 * SocialLinksEditor — Social Links Editor Foundation sprint, redesigned by
 * the Socials Tab Multi-Account UI sprint, restyled by the Socials Tab
 * Visual Polish sprint, connected to real persistence by the Social Links
 * persistence sprint.
 *
 * Was (every prior sprint through Visual Polish): a list editor over the
 * raw `TalentSocial` rows, but strictly local-state-only — "ביטול שינויים"
 * worked, "שמור כטיוטה"/"שלח לאישור" were hard-hidden
 * (`showSaveDraft={false} showSubmit={false}`) because no save path existed
 * for social rows yet.
 *
 * Is: the proposed column now seeds from a real persisted Draft/Proposed
 * set when one exists (`draftSocials`, read by
 * talentAdapter.getDraftOrProposedSocials — see
 * app/admin/talent/[id]/page.jsx), falling back to the published rows when
 * it doesn't, exactly the same "draftValue falls back to value" pattern
 * ComparisonView already established for TalentVersion fields. Save Draft
 * and Submit are real network calls now (against the new
 * app/api/admin/talent/[id]/socials[/submit] routes, backed by
 * lib/admin/engine/socialsService.js) — same "thin client wrapper owns the
 * fetch calls, not the generic editor" split TalentDetailsEditor already
 * uses for TalentVersion, just folded into this one component instead of a
 * separate wrapper, since SocialAccountCard/AddSocialAccountForm (this
 * component's children) were never split out as a generic, entity-agnostic
 * ComparisonView-style component the way פרטים/פודקאסט were.
 *
 * Still exactly the same "Current Published / Proposed Update" philosophy:
 * the employee always sees what's actually live (read-only cards) and
 * separately shapes a proposed set of accounts beneath it — nothing here
 * ever touches the live site. Gallery and SEO are explicitly NOT touched by
 * this sprint and remain preview-only.
 *
 * Per this sprint's explicit scope:
 *   - No redesign: every existing card/form/markup is unchanged; only the
 *     state/handlers around them changed.
 *   - Validation errors come back from the server (lib/admin/engine/
 *     socialsService.js's blocking validation) and are shown as a single,
 *     clear Hebrew summary plus a per-account note where possible, reusing
 *     `he.social.errors`.
 *
 * Social Remove sprint — a delete/remove-account control now exists
 * (SocialLinkRow.jsx's onRemove button), reusing the exact
 * lifecycleStatus-based mechanism MediaGalleryEditor already shipped for
 * Gallery (see galleryService.js's header comment for the full lifecycle
 * rationale, which applies unchanged here — TalentSocial already carried
 * the same dual-axis lifecycleStatus/versionStatus shape, it just had no
 * writable path for lifecycleStatus until this sprint):
 *   - A not-yet-saved account (no `id`) is spliced out of local state only
 *     — there is no database row to mark HIDDEN, nothing is ever sent to
 *     the server for it.
 *   - A saved account IS marked `lifecycleStatus: "HIDDEN"` (never deleted
 *     client-side) and stays in `proposedAccounts` so Save Draft still
 *     sends it — `visibleProposedAccounts` below is what actually renders,
 *     filtering HIDDEN rows out of the list the instant Remove is clicked.
 *   - `toComparablePayload` always forwards `lifecycleStatus`, defaulting
 *     to "ACTIVE" for every row a removal wasn't just clicked on, so a
 *     plain field edit can never accidentally flip it.
 *   - What removal actually *does* once saved (clone-and-hide vs.
 *     hide-in-place, Owner Review visibility, when the public site stops
 *     showing it) is entirely socialsService.saveDraft's decision — see
 *     that file's header comment — this component only ever expresses
 *     "the user wants this row gone" and lets the existing Draft ->
 *     Proposed -> Published pipeline do the rest.
 *
 * Props:
 *   - talentId (string, optional) — the Talent id. When absent, this
 *     component falls back to the original, fully local preview-only
 *     behavior (no talentId means there's nowhere to save to) — this keeps
 *     the component usable standalone/in isolation exactly like before.
 *   - publishedSocials ({ id, platform, label, customLabel, handle, url,
 *     sortOrder }[], optional, default []) — every published+active
 *     TalentSocial row, already in display order (repository-sorted).
 *   - draftSocials ({ id, platform, label, customLabel, handle, url,
 *     sortOrder, versionStatus, basedOnVersionId }[], optional, default
 *     []) — every DRAFT or PROPOSED TalentSocial row already saved for
 *     this talent. When non-empty, the proposed column seeds from this
 *     instead of `publishedSocials`.
 *   - rejectedSocials ({ id, platform, label, customLabel, handle, url,
 *     rejectionNote, ... }[], optional, default []) — Owner Approve/Reject
 *     (Social Links) sprint addition. Every REJECTED TalentSocial row for
 *     this talent (talentAdapter.getRejectedSocials), rendered as a notice
 *     above the comparison columns so the editor sees the Owner's note
 *     right next to where they'll fix it — not only in the History tab.
 *     Purely informational: this component still has no "resubmit a
 *     rejected row" control beyond editing it like any other proposed
 *     account and submitting again.
 *   - platforms ({ key, label, icon }[], optional, default SOCIAL_PLATFORMS)
 *   - labels ({ value, label }[], optional, default SOCIAL_ACCOUNT_LABELS)
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./SocialLinksEditor.module.css";
import SocialAccountCard from "./SocialLinkRow";
import AddSocialAccountForm from "./AddSocialAccountForm";
import EmptyState from "./EmptyState";
import EditorActionBar from "./EditorActionBar";
import PrimaryButton from "./PrimaryButton";
import { he } from "@/lib/admin/i18n/he";
import { SOCIAL_PLATFORMS, SOCIAL_ACCOUNT_LABELS, getPlatformEntry } from "@/lib/admin/social-platforms";
import { VERSION_STATUS, ROLE } from "@/lib/admin/constants/enums";
import { filterUnresolvedRejectedSocials } from "@/lib/admin/social-review";
import { deriveEffectiveEditing, deriveInitialLocalEditing } from "@/lib/admin/edit-mode";

function withKeys(accounts) {
  // Real DB rows already have a stable `id`; reuse it as the React/local-
  // state key so edits target the right card. A brand-new, not-yet-saved
  // account (added via the form, never persisted) has no `id` yet — see
  // handleAdd's `local-N` key below.
  return accounts.map((account) => ({ ...account, _key: account.id }));
}

// Only the fields the server actually accepts/returns are compared for
// dirty-state tracking and sent over the wire — `_key` is local-only React
// bookkeeping and `versionStatus`/`basedOnVersionId` are server-decided, not
// something this editor ever sets directly.
function toComparablePayload(accounts) {
  return accounts.map((account) => ({
    id: account.id || null,
    platform: account.platform,
    label: account.label,
    customLabel: account.customLabel ?? null,
    handle: account.handle ?? null,
    url: account.url ?? null,
    sortOrder: account.sortOrder ?? null,
    // Social Remove sprint — always forwarded (defaulting to ACTIVE for a
    // row that predates this field) so an account marked HIDDEN by
    // handleRemove is actually included in the Save Draft payload, even
    // though it's filtered out of what's rendered (see
    // visibleProposedAccounts below). Every field above this line is
    // preserved unchanged for a removal, exactly as-is — socialsService's
    // validateSocialAccount still requires platform/label/handle-or-url on
    // every row it sees, removed or not, so a removal payload must never
    // be trimmed down to just `{ id, lifecycleStatus }`.
    lifecycleStatus: account.lifecycleStatus ?? "ACTIVE",
  }));
}

/**
 * Social Remove sprint — the Remove button's actual state transition,
 * extracted as a small pure function (same reasoning social-review.js's
 * diff/filter helpers are pure and exported: testable without rendering,
 * and the one place this decision is made). Mirrors
 * MediaGalleryEditor.handleRemove's inline logic exactly:
 *   - a row with no `id` yet (added via the form, never saved) is spliced
 *     out entirely — there is no database row to mark HIDDEN;
 *   - a row with a real `id` is marked `lifecycleStatus: "HIDDEN"` in
 *     place, keeping its position/other fields untouched so Save Draft
 *     still sends the full account.
 *
 * @param {object[]} accounts - current proposedAccounts state
 * @param {string} key - the target account's `_key`
 * @returns {object[]} the next proposedAccounts state
 */
export function removeAccountFromProposed(accounts, key) {
  const target = accounts.find((account) => account._key === key);
  if (!target) return accounts;
  if (!target.id) {
    return accounts.filter((account) => account._key !== key);
  }
  return accounts.map((account) =>
    account._key === key ? { ...account, lifecycleStatus: "HIDDEN" } : account
  );
}

/*
 * Stand-in for the retired shared <EditorHelperNote>, same reasoning
 * MediaGalleryEditor/SeoEditor's own per-tab notices already document: this
 * tab's actual capabilities have changed over time, so its honesty notice
 * needs to say the true thing for whichever mode it's in right now, not a
 * generic "save a draft" message that may or may not apply.
 */
function PreviewModeNotice() {
  return (
    <div className={styles.previewNotice} role="note">
      <p className={styles.previewNoticeTitle}>{he.social.previewModeNotice.title}</p>
      <p className={styles.previewNoticeBody}>{he.social.previewModeNotice.body}</p>
    </div>
  );
}

function PersistenceModeNote() {
  return (
    <div className={styles.previewNotice} role="note">
      <p className={styles.previewNoticeBody}>{he.editor.helperNote.body}</p>
    </div>
  );
}

/*
 * Owner Approve/Reject (Social Links) sprint — one notice per REJECTED
 * TalentSocial row, rendered above the comparison columns, so the editor
 * sees the Owner's note right next to where they'll fix it — not only in
 * the History tab.
 *
 * Rejected Resubmission Recovery sprint — no longer purely read-only: each
 * notice now carries a "המשך תיקון" / "Continue fixing" action
 * (socialsService.resumeRejected via POST .../socials/[socialId]/resume)
 * that creates a fresh, editable DRAFT continuing that account's lineage
 * (see that service method's header comment for how `basedOnVersionId` is
 * preserved/anchored). `rejectedSocials` is expected to already be filtered
 * to only the *unresolved* rejections (social-review.js's
 * `filterUnresolvedRejectedSocials`, applied by the parent component below)
 * — once the new Draft this button creates exists, a fresh `router.refresh()`
 * re-derives that filtered list and this notice disappears on its own,
 * with no separate "dismiss" control needed.
 *
 * Each rejected row owns its own loading/error state (keyed by account id)
 * so resuming one account's notice never disables another's button.
 */
function RejectedSocialsNotice({ talentId, rejectedSocials }) {
  const router = useRouter();
  const [resumingId, setResumingId] = useState(null);
  const [resumeErrors, setResumeErrors] = useState({});

  if (!rejectedSocials || rejectedSocials.length === 0) return null;

  async function handleResume(accountId) {
    if (!talentId || resumingId) return;

    setResumingId(accountId);
    setResumeErrors((previous) => ({ ...previous, [accountId]: null }));

    try {
      const response = await fetch(`/api/admin/talent/${talentId}/socials/${accountId}/resume`, {
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || he.social.rejectionNotice.resumeError);
      }

      // Mirrors handleSubmit's pattern below: the new Draft this just
      // created lives only in the database until the Server Component tree
      // re-fetches, which is also what makes this notice disappear (the
      // page's filtered rejectedSocials list now finds a newer row in this
      // account's lineage).
      router.refresh();
    } catch (error) {
      setResumeErrors((previous) => ({
        ...previous,
        [accountId]: error?.message || he.social.rejectionNotice.resumeError,
      }));
    } finally {
      setResumingId(null);
    }
  }

  return (
    <div className={styles.previewNotice} role="alert">
      <p className={styles.previewNoticeTitle}>
        {he.social.rejectionNotice.eyebrowIcon} {he.social.rejectionNotice.title}
      </p>
      <p className={styles.previewNoticeBody}>{he.social.rejectionNotice.subtitle}</p>
      {rejectedSocials.map((account) => {
        const platformEntry = getPlatformEntry(account.platform);
        const platformLabel = platformEntry?.label || account.platform;
        const isResuming = resumingId === account.id;
        const resumeError = resumeErrors[account.id];
        return (
          <div key={account.id} className={styles.previewNoticeBody}>
            <p>
              <strong>{platformLabel}{account.handle ? ` (@${account.handle.replace(/^@+/, "")})` : ""}:</strong>{" "}
              {he.social.rejectionNotice.noteLabel}: {account.rejectionNote}
            </p>
            {talentId ? (
              <PrimaryButton
                type="button"
                onClick={() => handleResume(account.id)}
                disabled={Boolean(resumingId)}
              >
                {isResuming ? he.social.rejectionNotice.resuming : he.social.rejectionNotice.resumeAction}
              </PrimaryButton>
            ) : null}
            {resumeError ? (
              <p className={styles.previewNoticeBody} role="alert">
                {resumeError}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function SocialLinksEditor({
  talentId = null,
  publishedSocials = [],
  draftSocials = [],
  rejectedSocials = [],
  platforms = SOCIAL_PLATFORMS,
  labels = SOCIAL_ACCOUNT_LABELS,
  role = null,
  // Global Edit Mode UX sprint — true when the page-level "Start Editing"
  // flow is active (a pending TalentVersion DRAFT/PROPOSED exists — derived
  // by app/admin/talent/[id]/page.jsx via isGlobalEditingStatus, a pure
  // read of state the page already loads). When true, this tab's editable
  // surface opens immediately and the local "התחל בעריכה" CTA is never
  // rendered — one edit activation for the whole page. UX-only: TalentSocial
  // draft rows are still only ever created by Save Draft, and every
  // Save/Submit/Publish/Resume flow below is untouched.
  globalEditing = false,
}) {
  const router = useRouter();
  const hasPersistence = Boolean(talentId);
  const isOwner = role === ROLE.OWNER;
  const initialSeed = draftSocials.length > 0 ? draftSocials : publishedSocials;

  // Rejected Resubmission Recovery sprint — hide any REJECTED notice that's
  // already been superseded by a newer row in the same lineage (e.g. a
  // Draft created via the "Continue fixing" button below, or any other
  // edit that happened since). See social-review.js's
  // filterUnresolvedRejectedSocials for the matching rule.
  const unresolvedRejectedSocials = filterUnresolvedRejectedSocials(rejectedSocials, [
    ...publishedSocials,
    ...draftSocials,
    ...rejectedSocials,
  ]);

  const [proposedAccounts, setProposedAccounts] = useState(() => withKeys(initialSeed));
  const [savedAccounts, setSavedAccounts] = useState(() => withKeys(initialSeed));
  // Monotonic counter for client-only ids on accounts added via the form —
  // never sent anywhere, just needs to be unique within this render tree.
  const [nextLocalId, setNextLocalId] = useState(1);

  // Social Remove sprint — what actually renders. An account marked HIDDEN
  // by handleRemove stays in `proposedAccounts` (so save/dirty-check logic
  // below keeps treating it as part of the set), but is excluded here so it
  // visually disappears from the list the instant it's removed. Mirrors
  // MediaGalleryEditor's visibleProposedImages exactly.
  const visibleProposedAccounts = proposedAccounts.filter(
    (account) => account.lifecycleStatus !== "HIDDEN"
  );

  // Single-Section Editing UX sprint — collapses the old simultaneous
  // "Published" + "Proposed" two-section layout into one section that
  // toggles between a read-only view and the exact same editable surface,
  // mirroring ComparisonView/ImageAssetEditor's Phase 1/2 pattern.
  //
  // One Edit Activation sprint — there is no local manual activation
  // anymore. `hasModuleDraft` only reflects whether a real socials
  // Draft/Proposed set already exists (resuming a session in progress reads
  // as "still editing," not back to a fresh view); it is never flipped true
  // by a button click. The effective mode actually rendered is the derived
  // `isEditing` const below — `globalEditing || hasModuleDraft` —
  // recomputed every render. When globalEditing later flips false (page
  // draft published/discarded), the tab falls back to hasModuleDraft on its
  // own: a socials draft keeps its session editable, otherwise the
  // read-only view returns. The only way to *begin* an editing session from
  // nothing is the page-level header button.
  const hasModuleDraft = deriveInitialLocalEditing(draftSocials);
  const isEditing = deriveEffectiveEditing({ globalEditing, localEditing: hasModuleDraft });

  const [saveDraftStatus, setSaveDraftStatus] = useState("idle"); // idle | saving | saved | error
  const [saveDraftError, setSaveDraftError] = useState(null);
  const [submitStatus, setSubmitStatus] = useState("idle"); // idle | submitting | submitted | error
  const [submitError, setSubmitError] = useState(null);
  // Owner Direct Publish UX sprint — same idle/in-flight/error shape as
  // saveDraftStatus/submitStatus above, for the Owner-only Publish Now
  // action.
  const [publishStatus, setPublishStatus] = useState("idle"); // idle | publishing | published | error
  const [publishError, setPublishError] = useState(null);

  const isDirty =
    JSON.stringify(toComparablePayload(proposedAccounts)) !==
    JSON.stringify(toComparablePayload(savedAccounts));
  const saving = saveDraftStatus === "saving";
  const submitting = submitStatus === "submitting";
  const publishing = publishStatus === "publishing";
  const hasDraftRows = savedAccounts.some((account) => account.versionStatus === VERSION_STATUS.DRAFT);
  // Owner Direct Publish UX sprint — unlike hasDraftRows (Submit is
  // DRAFT-only), Publish Now also works on a row that's already PROPOSED
  // (e.g. one an Employee already submitted) — see TalentDetailsEditor's
  // analogous comment for the same distinction.
  const hasPublishableRows = savedAccounts.some(
    (account) => account.versionStatus === VERSION_STATUS.DRAFT || account.versionStatus === VERSION_STATUS.PROPOSED
  );

  const saveDraftDisabled = !hasPersistence || !isDirty || saving || submitting;
  const submitDisabled = !hasPersistence || isDirty || saving || submitting || !hasDraftRows;
  const publishDisabled =
    !hasPersistence || !isOwner || isDirty || saving || submitting || publishing || !hasPublishableRows;

  const saveDraftDisabledReason = !hasPersistence
    ? undefined
    : !isDirty
      ? he.editor.saveDraft.disabledNoChanges
      : undefined;
  const submitDisabledReason = !hasPersistence
    ? undefined
    : isDirty
      ? he.editor.submit.unsavedHint
      : !hasDraftRows
        ? he.social.errors.nothingToSubmit
        : undefined;
  const publishDisabledReason = !hasPersistence
    ? undefined
    : isDirty
      ? he.editor.publish.unsavedHint
      : !hasPublishableRows
        ? he.editor.publish.disabledNothingToPublish
        : undefined;

  function clearStatuses() {
    if (saveDraftStatus !== "idle" && saveDraftStatus !== "saving") {
      setSaveDraftStatus("idle");
      setSaveDraftError(null);
    }
    if (submitStatus !== "idle" && submitStatus !== "submitting") {
      setSubmitStatus("idle");
      setSubmitError(null);
    }
    if (publishStatus !== "idle" && publishStatus !== "publishing") {
      setPublishStatus("idle");
      setPublishError(null);
    }
  }

  // Implementation Sprint A, Phase 1 — state synchronization after Publish.
  // Same bug/fix shape as ComparisonView's analogous effect: handlePublishNow
  // (and handleSubmit) call `router.refresh()`, which re-renders this
  // component with fresh `publishedSocials`/`draftSocials` props, but never
  // remounts it — so `proposedAccounts`/`savedAccounts`, seeded once via
  // `useState(() => withKeys(initialSeed))`, would otherwise stay frozen on
  // the pre-publish rows forever, along with whatever save/submit/publish
  // status was last set. Guarded by `!isDirty` for the same reason
  // ProfileImagePanel's sync effect is: Publish/Submit are only clickable
  // while clean, so by the time either succeeds and props change,
  // proposedAccounts already equals savedAccounts — resyncing both to the
  // fresh server rows can never clobber an in-progress, unsaved edit.
  const initialSeedKey = JSON.stringify(toComparablePayload(initialSeed));
  useEffect(() => {
    if (!isDirty) {
      const refreshed = withKeys(initialSeed);
      setProposedAccounts(refreshed);
      setSavedAccounts(refreshed);
      setSaveDraftStatus("idle");
      setSaveDraftError(null);
      setSubmitStatus("idle");
      setSubmitError(null);
      setPublishStatus("idle");
      setPublishError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSeedKey]);

  function handleFieldChange(key, field, value) {
    setProposedAccounts((previous) =>
      previous.map((account) => (account._key === key ? { ...account, [field]: value } : account))
    );
    clearStatuses();
  }

  // Social Remove sprint — see removeAccountFromProposed's own header
  // comment for the no-id-vs-real-id split. This handler owns only the
  // state update; the decision logic is the extracted pure function so it
  // can be unit-tested without rendering.
  function handleRemove(key) {
    setProposedAccounts((previous) => removeAccountFromProposed(previous, key));
    clearStatuses();
  }

  // Resets back to whatever was last actually saved (or, if nothing has
  // been saved yet this session, the original published/draft seed) —
  // never talks to a server.
  // One Edit Activation sprint — Cancel only resets the in-memory values.
  // There is no local activation flag to clear anymore: while globalEditing
  // is active the tab stays editable (one activation for the whole page),
  // and while a module draft exists the tab stays editable on its own too —
  // there is no per-tab exit from either.
  function handleCancel() {
    setProposedAccounts(savedAccounts);
    setSaveDraftStatus("idle");
    setSaveDraftError(null);
  }

  // Appends, never replaces — this is what guarantees a second Instagram
  // account becomes a second card instead of overwriting the first one,
  // since nothing here is keyed by platform.
  function handleAdd(newAccount) {
    setProposedAccounts((previous) => [
      ...previous,
      { ...newAccount, id: null, sortOrder: null, _key: `local-${nextLocalId}` },
    ]);
    setNextLocalId((n) => n + 1);
    clearStatuses();
  }

  async function handleSaveDraft() {
    if (!hasPersistence || saveDraftDisabled) return;

    setSaveDraftStatus("saving");
    setSaveDraftError(null);

    try {
      const response = await fetch(`/api/admin/talent/${talentId}/socials`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts: toComparablePayload(proposedAccounts) }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (body.code === "VALIDATION_FAILED") {
          throw new Error(he.social.errors.validationSummary);
        }
        throw new Error(body.error || he.social.errors.serverError);
      }

      const saved = withKeys(body.accounts || []);
      setProposedAccounts(saved);
      setSavedAccounts(saved);
      setSaveDraftStatus("saved");
    } catch (error) {
      setSaveDraftStatus("error");
      setSaveDraftError(error?.message || he.social.errors.networkError);
    }
  }

  async function handleSubmit() {
    if (!hasPersistence || submitDisabled) return;

    setSubmitStatus("submitting");
    setSubmitError(null);

    try {
      const response = await fetch(`/api/admin/talent/${talentId}/socials/submit`, {
        method: "POST",
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || he.social.errors.serverError);
      }

      setSubmitStatus("submitted");
      // Re-fetch the Server Component tree so the page's own
      // getDraftOrProposedSocials read picks up the new PROPOSED status —
      // same pattern TalentDetailsEditor.handleSubmit already uses for
      // TalentVersion.
      router.refresh();
    } catch (error) {
      setSubmitStatus("error");
      setSubmitError(error?.message || he.social.errors.networkError);
    }
  }

  // Owner Direct Publish UX sprint — POSTs to the new
  // app/api/admin/talent/[id]/socials/publish/route.js, which composes the
  // *existing* socialsService.submit() (only for rows still DRAFT) and
  // socialsService.approve() (looped over every now-PROPOSED row) — no new
  // business logic, an OWNER-only route doing in one request what an Owner
  // clicking Submit then Approve on every row would already do today.
  async function handlePublishNow() {
    if (!hasPersistence || publishDisabled) return;

    setPublishStatus("publishing");
    setPublishError(null);

    try {
      const response = await fetch(`/api/admin/talent/${talentId}/socials/publish`, {
        method: "POST",
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || he.editor.publish.error);
      }

      setPublishStatus("published");
      router.refresh();
    } catch (error) {
      setPublishStatus("error");
      setPublishError(error?.message || he.editor.publish.error);
    }
  }

  return (
    <div className={styles.tokens}>
      <RejectedSocialsNotice talentId={talentId} rejectedSocials={unresolvedRejectedSocials} />

      {/*
       * Single-Section Editing UX sprint — one section, one mode at a time,
       * mirroring ComparisonView's Phase 1 pattern exactly (see that file's
       * header comment). `isEditing` here is derived per render from the
       * page-level `globalEditing` prop OR the local activation state (see
       * above) rather than `Boolean(onSaveDraft)`, since Social Links has no
       * separate Draft entity gating whether editing is possible at all —
       * anyone can open the section and start typing; Save Draft is what
       * actually persists it.
       */}
      <section
        className={isEditing ? styles.proposedSection : styles.publishedSection}
        aria-label={isEditing ? he.editor.sectionEditingLabel : he.editor.sectionViewLabel}
      >
        <header className={styles.eyebrow}>
          <span className={styles.eyebrowIcon} aria-hidden="true">
            {isEditing ? "✏️" : "🌍"}
          </span>
          <span className={isEditing ? styles.eyebrowTitleProposed : styles.eyebrowTitle}>
            {isEditing ? he.editor.sectionEditingLabel : he.editor.sectionViewLabel}
          </span>
        </header>
        <p className={isEditing ? styles.proposedSubtitle : styles.publishedSubtitle}>
          {isEditing ? he.editor.sectionEditingSubtitle : he.editor.sectionViewSubtitle}
        </p>

        {isEditing ? (
          visibleProposedAccounts.length === 0 ? (
            <EmptyState
              title={he.social.noProposedAccountsTitle}
              description={he.social.noProposedAccountsDescription}
              action={<AddSocialAccountForm platforms={platforms} labels={labels} onAdd={handleAdd} />}
            />
          ) : (
            <div className={styles.accountListEditable}>
              {visibleProposedAccounts.map((account) => (
                <SocialAccountCard
                  key={account._key}
                  account={account}
                  showNotSavedBadge={!account.id}
                  onChange={(field, value) => handleFieldChange(account._key, field, value)}
                  onRemove={() => handleRemove(account._key)}
                />
              ))}
              <AddSocialAccountForm platforms={platforms} labels={labels} onAdd={handleAdd} />
            </div>
          )
        ) : publishedSocials.length === 0 ? (
          <EmptyState
            title={he.social.noPublishedAccountsTitle}
            description={he.social.noPublishedAccountsDescription}
          />
        ) : (
          <div className={styles.accountList}>
            {publishedSocials.map((account) => (
              <SocialAccountCard key={account.id} account={account} readOnly />
            ))}
          </div>
        )}
      </section>

      {isEditing ? (
        <>
          {hasPersistence ? <PersistenceModeNote /> : <PreviewModeNotice />}
          {saveDraftStatus === "error" && saveDraftError ? (
            <p className={styles.previewNoticeBody} role="alert">
              {saveDraftError}
            </p>
          ) : null}
          <EditorActionBar
            onCancel={handleCancel}
            onSaveDraft={handleSaveDraft}
            onSubmit={handleSubmit}
            onPublish={handlePublishNow}
            showSaveDraft={hasPersistence}
            showSubmit={hasPersistence && !isOwner}
            showPublish={hasPersistence && isOwner}
            saveDraftDisabled={saveDraftDisabled}
            saveDraftDisabledReason={saveDraftDisabledReason}
            saveDraftStatus={saveDraftStatus}
            saveDraftStatusMessage={saveDraftStatus === "error" ? saveDraftError : undefined}
            submitDisabled={submitDisabled}
            submitDisabledReason={submitDisabledReason}
            submitStatus={submitStatus}
            submitStatusMessage={submitStatus === "error" ? submitError : undefined}
            publishDisabled={publishDisabled}
            publishDisabledReason={publishDisabledReason}
            publishStatus={publishStatus}
            publishStatusMessage={publishStatus === "error" ? publishError : undefined}
          />
        </>
      ) : null}
    </div>
  );
}
