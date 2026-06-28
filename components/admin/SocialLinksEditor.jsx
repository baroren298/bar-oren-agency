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
 *   - No delete/remove-account control exists (none did before either —
 *     SocialLinkRow.jsx still has no such button); this sprint doesn't add
 *     one.
 *   - Validation errors come back from the server (lib/admin/engine/
 *     socialsService.js's blocking validation) and are shown as a single,
 *     clear Hebrew summary plus a per-account note where possible, reusing
 *     `he.social.errors`.
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

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./SocialLinksEditor.module.css";
import SocialAccountCard from "./SocialLinkRow";
import AddSocialAccountForm from "./AddSocialAccountForm";
import EmptyState from "./EmptyState";
import EditorActionBar from "./EditorActionBar";
import { he } from "@/lib/admin/i18n/he";
import { SOCIAL_PLATFORMS, SOCIAL_ACCOUNT_LABELS, getPlatformEntry } from "@/lib/admin/social-platforms";
import { VERSION_STATUS } from "@/lib/admin/constants/enums";

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
  }));
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
 * TalentSocial row, rendered above the comparison columns. Read-only: this
 * is purely a "here's what the Owner said" surface, the same way
 * SocialLinksOwnerReview's columns are read-only diffs — fixing a rejected
 * account still happens by editing whichever proposed account card already
 * exists for it below (or re-adding it), there is no separate "resolve
 * rejection" control in this sprint's scope.
 */
function RejectedSocialsNotice({ rejectedSocials }) {
  if (!rejectedSocials || rejectedSocials.length === 0) return null;

  return (
    <div className={styles.previewNotice} role="alert">
      <p className={styles.previewNoticeTitle}>
        {he.social.rejectionNotice.eyebrowIcon} {he.social.rejectionNotice.title}
      </p>
      <p className={styles.previewNoticeBody}>{he.social.rejectionNotice.subtitle}</p>
      {rejectedSocials.map((account) => {
        const platformEntry = getPlatformEntry(account.platform);
        const platformLabel = platformEntry?.label || account.platform;
        return (
          <p key={account.id} className={styles.previewNoticeBody}>
            <strong>{platformLabel}{account.handle ? ` (@${account.handle.replace(/^@+/, "")})` : ""}:</strong>{" "}
            {he.social.rejectionNotice.noteLabel}: {account.rejectionNote}
          </p>
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
}) {
  const router = useRouter();
  const hasPersistence = Boolean(talentId);
  const initialSeed = draftSocials.length > 0 ? draftSocials : publishedSocials;

  const [proposedAccounts, setProposedAccounts] = useState(() => withKeys(initialSeed));
  const [savedAccounts, setSavedAccounts] = useState(() => withKeys(initialSeed));
  // Monotonic counter for client-only ids on accounts added via the form —
  // never sent anywhere, just needs to be unique within this render tree.
  const [nextLocalId, setNextLocalId] = useState(1);

  const [saveDraftStatus, setSaveDraftStatus] = useState("idle"); // idle | saving | saved | error
  const [saveDraftError, setSaveDraftError] = useState(null);
  const [submitStatus, setSubmitStatus] = useState("idle"); // idle | submitting | submitted | error
  const [submitError, setSubmitError] = useState(null);

  const isDirty =
    JSON.stringify(toComparablePayload(proposedAccounts)) !==
    JSON.stringify(toComparablePayload(savedAccounts));
  const saving = saveDraftStatus === "saving";
  const submitting = submitStatus === "submitting";
  const hasDraftRows = savedAccounts.some((account) => account.versionStatus === VERSION_STATUS.DRAFT);

  const saveDraftDisabled = !hasPersistence || !isDirty || saving || submitting;
  const submitDisabled = !hasPersistence || isDirty || saving || submitting || !hasDraftRows;

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

  function clearStatuses() {
    if (saveDraftStatus !== "idle" && saveDraftStatus !== "saving") {
      setSaveDraftStatus("idle");
      setSaveDraftError(null);
    }
    if (submitStatus !== "idle" && submitStatus !== "submitting") {
      setSubmitStatus("idle");
      setSubmitError(null);
    }
  }

  function handleFieldChange(key, field, value) {
    setProposedAccounts((previous) =>
      previous.map((account) => (account._key === key ? { ...account, [field]: value } : account))
    );
    clearStatuses();
  }

  // Resets back to whatever was last actually saved (or, if nothing has
  // been saved yet this session, the original published/draft seed) —
  // never talks to a server.
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

  return (
    <div className={styles.tokens}>
      <RejectedSocialsNotice rejectedSocials={rejectedSocials} />
      <div className={styles.comparison}>
        <section className={styles.publishedSection} aria-label={he.social.publishedEyebrowTitle}>
          <header className={styles.eyebrow}>
            <span className={styles.eyebrowIcon} aria-hidden="true">
              {he.social.publishedEyebrowIcon}
            </span>
            <span className={styles.eyebrowTitle}>{he.social.publishedEyebrowTitle}</span>
          </header>
          <p className={styles.publishedSubtitle}>{he.social.publishedSubtitle}</p>

          {publishedSocials.length === 0 ? (
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

        <section className={styles.proposedSection} aria-label={he.social.proposedEyebrowTitle}>
          <header className={styles.eyebrow}>
            <span className={styles.eyebrowIcon} aria-hidden="true">
              {he.social.proposedEyebrowIcon}
            </span>
            <span className={styles.eyebrowTitleProposed}>{he.social.proposedEyebrowTitle}</span>
          </header>
          <p className={styles.proposedSubtitle}>{he.social.proposedSubtitle}</p>

          {proposedAccounts.length === 0 ? (
            <EmptyState
              title={he.social.noProposedAccountsTitle}
              description={he.social.noProposedAccountsDescription}
              action={<AddSocialAccountForm platforms={platforms} labels={labels} onAdd={handleAdd} />}
            />
          ) : (
            <div className={styles.accountListEditable}>
              {proposedAccounts.map((account) => (
                <SocialAccountCard
                  key={account._key}
                  account={account}
                  showNotSavedBadge={!account.id}
                  onChange={(field, value) => handleFieldChange(account._key, field, value)}
                />
              ))}
              <AddSocialAccountForm platforms={platforms} labels={labels} onAdd={handleAdd} />
            </div>
          )}
        </section>
      </div>

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
        showSaveDraft={hasPersistence}
        showSubmit={hasPersistence}
        saveDraftDisabled={saveDraftDisabled}
        saveDraftDisabledReason={saveDraftDisabledReason}
        saveDraftStatus={saveDraftStatus}
        saveDraftStatusMessage={saveDraftStatus === "error" ? saveDraftError : undefined}
        submitDisabled={submitDisabled}
        submitDisabledReason={submitDisabledReason}
        submitStatus={submitStatus}
        submitStatusMessage={submitStatus === "error" ? submitError : undefined}
      />
    </div>
  );
}
