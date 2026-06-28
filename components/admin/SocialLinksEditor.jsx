"use client";

/*
 * SocialLinksEditor — Social Links Editor Foundation sprint, redesigned by
 * the Socials Tab Multi-Account UI sprint, restyled by the Socials Tab
 * Visual Polish sprint (presentation only — see SocialLinkRow.jsx's own
 * docstring for what changed there; this file's state/handlers/props are
 * untouched, only `.cardList` was renamed to `.accountList`/
 * `.accountListEditable` and the preview notice below was lightened to
 * match ComparisonView's `.conflictNotice`).
 *
 * Was: one fixed row per platform, fed by a flat `{ [platformKey]: string }`
 * map — a shape that could only ever show one account per platform, so a
 * second Instagram ("Spam") was silently dropped before it reached this
 * component (the collapsing happened one level up, in
 * app/admin/talent/[id]/page.jsx's `buildSocialLinks`).
 *
 * Is: a list editor over the *raw* `TalentSocial` rows the DB already
 * returns — `talentRepository.getPublishedSocialsForTalent` never collapsed
 * multiple accounts per platform (see that file's own docstring), only this
 * UI did. `buildSocialLinks` is gone; the talent workspace page now passes
 * every published row straight through as `publishedSocials`, and this
 * component renders one <SocialAccountCard> per row, full stop.
 *
 * Same "Current Published / Proposed Update" philosophy as before: the
 * employee always sees what's actually live (read-only cards) and
 * separately shapes a proposed set of accounts beneath it (editable cards
 * + an "add platform" form) — nothing here ever touches the live site.
 *
 * Entity-agnostic, same reasoning as its siblings: this component knows
 * nothing about "talent" specifically, only a `publishedSocials` array
 * ({ id, platform, label, customLabel, handle, url, sortOrder }[]) and a
 * `platforms`/`labels` registry — reusable later for agency social links,
 * contact info, footer links, or brand pages.
 *
 * Strictly UI-only, per this sprint's explicit scope (same as before, just
 * restated for the new shape):
 *   - No real persistence, no API calls, no database writes. Editing an
 *     existing card's fields and adding a new card via
 *     <AddSocialAccountForm> are both real against the in-memory
 *     `proposedAccounts` array (same "local state isn't persistence"
 *     reasoning ComparisonView/MediaGalleryEditor already use for their
 *     own real-but-local actions) — refreshing the page discards everything.
 *   - "ביטול שינויים" resets `proposedAccounts` back to the published list
 *     (discarding any local edits/additions). "שמור כטיוטה"/"שלח לאישור"
 *     stay disabled placeholders via EditorActionBar's existing defaults —
 *     no safe save path exists for social rows yet
 *     (talentRepository.proposeTalentSocial is still an unimplemented stub).
 *   - <PreviewModeNotice> below states this explicitly, same honesty
 *     pattern MediaGalleryEditor's own notice already established, since
 *     this tab can now do more than the old "type into 5 fixed fields."
 *
 * Future Ready: adding a new platform is still a one-line addition to
 * lib/admin/social-platforms.js (see THREADS); no change needed here.
 *
 * Props:
 *   - publishedSocials ({ id, platform, label, customLabel, handle, url,
 *     sortOrder }[], optional, default []) — every published+active
 *     TalentSocial row, already in display order (repository-sorted).
 *     Multiple rows may share a platform; none are dropped.
 *   - platforms ({ key, label, icon }[], optional, default SOCIAL_PLATFORMS)
 *   - labels ({ value, label }[], optional, default SOCIAL_ACCOUNT_LABELS)
 */

import { useState } from "react";
import styles from "./SocialLinksEditor.module.css";
import SocialAccountCard from "./SocialLinkRow";
import AddSocialAccountForm from "./AddSocialAccountForm";
import EmptyState from "./EmptyState";
import EditorActionBar from "./EditorActionBar";
import { he } from "@/lib/admin/i18n/he";
import { SOCIAL_PLATFORMS, SOCIAL_ACCOUNT_LABELS } from "@/lib/admin/social-platforms";

function withKeys(accounts) {
  // Real published rows already have a stable DB `id`; reuse it as the
  // React/local-state key so edits target the right card.
  return accounts.map((account) => ({ ...account, _key: account.id }));
}

/*
 * Gallery-specific stand-in for the retired shared <EditorHelperNote>,
 * reused here for the same reason MediaGalleryEditor introduced it: this
 * tab can now genuinely add/edit accounts in memory, so a generic "this is
 * a proposed update, save a draft" message would overstate what's actually
 * wired (no save/submit path exists for social rows yet).
 */
function PreviewModeNotice() {
  return (
    <div className={styles.previewNotice} role="note">
      <p className={styles.previewNoticeTitle}>{he.social.previewModeNotice.title}</p>
      <p className={styles.previewNoticeBody}>{he.social.previewModeNotice.body}</p>
    </div>
  );
}

export default function SocialLinksEditor({
  publishedSocials = [],
  platforms = SOCIAL_PLATFORMS,
  labels = SOCIAL_ACCOUNT_LABELS,
}) {
  const [proposedAccounts, setProposedAccounts] = useState(() => withKeys(publishedSocials));
  // Monotonic counter for client-only ids on accounts added via the form —
  // never sent anywhere, just needs to be unique within this render tree.
  const [nextLocalId, setNextLocalId] = useState(1);

  function handleFieldChange(key, field, value) {
    setProposedAccounts((previous) =>
      previous.map((account) => (account._key === key ? { ...account, [field]: value } : account))
    );
  }

  // Local-only reset — never talks to a server, just discards whatever the
  // employee typed/added and snaps the proposed list back to published.
  function handleCancel() {
    setProposedAccounts(withKeys(publishedSocials));
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
  }

  return (
    <div className={styles.tokens}>
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
                  showNotSavedBadge
                  onChange={(field, value) => handleFieldChange(account._key, field, value)}
                />
              ))}
              <AddSocialAccountForm platforms={platforms} labels={labels} onAdd={handleAdd} />
            </div>
          )}
        </section>
      </div>

      <PreviewModeNotice />
      <EditorActionBar onCancel={handleCancel} showSaveDraft={false} showSubmit={false} />
    </div>
  );
}
