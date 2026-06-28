"use client";

/*
 * AddSocialAccountForm — Socials Tab Multi-Account UI sprint, restyled by
 * the Socials Tab Visual Polish sprint.
 *
 * The "+ הוסף פלטפורמה" affordance at the end of the proposed accounts
 * list. Unlike Gallery's <AddImageCard> (disabled — it would need a real
 * upload pipeline), this one is genuinely interactive: there's no upload
 * involved in adding a social account, just a handful of text/select
 * fields, so collapsed → expanded → "הוסף" really does push a new account
 * into SocialLinksEditor's in-memory `proposedAccounts` array. That's still
 * not persistence (same "local state isn't the database" reasoning every
 * other editor here already uses for its real-but-local actions) — nothing
 * here calls an API or touches Postgres.
 *
 * Deliberately allows picking a platform that already has a card in the
 * list above (req: "adding another Instagram should create a new row
 * conceptually, not overwrite the existing Instagram row") — this form has
 * no awareness of what's already in the list, it just emits one more
 * account object; SocialLinksEditor appends rather than keying by platform,
 * so a second Instagram naturally becomes a second card, never a
 * replacement.
 *
 * Entity-agnostic, same reasoning as its siblings: takes a `platforms` /
 * `labels` registry and an `onAdd` callback, nothing talent-specific.
 *
 * Visual Polish sprint — presentation only, no change to state or
 * `handleSubmit`/`onAdd` logic. Was a dashed-border box with custom
 * Cancel/Submit buttons; now reuses the shared <SecondaryButton>/
 * <PrimaryButton> components every other editor's action bar already uses
 * (EditorActionBar, etc.), and the trigger/form boxes lost their heavy
 * dashed border in favor of the same light surface ComparisonView uses.
 *
 * Props:
 *   - platforms ({ key, label, icon }[], optional, default SOCIAL_PLATFORMS)
 *   - labels ({ value, label }[], optional, default SOCIAL_ACCOUNT_LABELS)
 *   - onAdd (function) — ({ platform, label, customLabel, handle, url }) => void
 *     `platform` is emitted as the raw uppercase Prisma enum value (e.g.
 *     "INSTAGRAM"), matching every other account object's shape.
 */

import { useState } from "react";
import styles from "./AddSocialAccountForm.module.css";
import { he } from "@/lib/admin/i18n/he";
import { SOCIAL_PLATFORMS, SOCIAL_ACCOUNT_LABELS } from "@/lib/admin/social-platforms";
import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";

const EMPTY_FORM = (platforms, labels) => ({
  platformKey: platforms[0]?.key || "",
  label: labels[0]?.value || "MAIN",
  customLabel: "",
  handle: "",
  url: "",
});

export default function AddSocialAccountForm({
  platforms = SOCIAL_PLATFORMS,
  labels = SOCIAL_ACCOUNT_LABELS,
  onAdd = () => {},
}) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState(() => EMPTY_FORM(platforms, labels));

  function updateField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function resetAndCollapse() {
    setForm(EMPTY_FORM(platforms, labels));
    setExpanded(false);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.handle.trim() && !form.url.trim()) return; // nothing to add yet

    onAdd({
      platform: form.platformKey.toUpperCase(),
      label: form.label,
      customLabel: form.label === "OTHER" ? form.customLabel.trim() || null : null,
      handle: form.handle.trim() || null,
      url: form.url.trim() || null,
    });
    resetAndCollapse();
  }

  if (!expanded) {
    return (
      <button type="button" className={`${styles.tokens} ${styles.trigger}`} onClick={() => setExpanded(true)}>
        {he.social.addAccount.trigger}
      </button>
    );
  }

  const canSubmit = Boolean(form.handle.trim() || form.url.trim());

  return (
    <form className={`${styles.tokens} ${styles.form}`} onSubmit={handleSubmit}>
      <p className={styles.formTitle}>{he.social.addAccount.formTitle}</p>

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{he.social.addAccount.platformLabel}</span>
          <select
            className={styles.select}
            value={form.platformKey}
            onChange={(event) => updateField("platformKey", event.target.value)}
          >
            {platforms.map((platform) => (
              <option key={platform.key} value={platform.key}>
                {platform.icon} {platform.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{he.social.fields.label}</span>
          <select
            className={styles.select}
            value={form.label}
            onChange={(event) => updateField("label", event.target.value)}
          >
            {labels.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        {form.label === "OTHER" ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{he.social.fields.customLabel}</span>
            <input
              type="text"
              className={styles.input}
              value={form.customLabel}
              placeholder={he.social.fields.customLabelPlaceholder}
              onChange={(event) => updateField("customLabel", event.target.value)}
            />
            <span className={styles.fieldHelper}>{he.social.fields.customLabelHelper}</span>
          </label>
        ) : null}

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{he.social.fields.handle}</span>
          <input
            type="text"
            className={styles.input}
            value={form.handle}
            placeholder={he.social.fields.handlePlaceholder}
            // Same "username only, no leading @" normalization as the
            // editable SocialLinkRow handle field — strip any leading "@"
            // (single or doubled) immediately on type/paste.
            onChange={(event) => updateField("handle", event.target.value.replace(/^@+/, ""))}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{he.social.fields.url}</span>
          <input
            type="text"
            className={styles.input}
            value={form.url}
            placeholder={he.social.fields.urlPlaceholder}
            onChange={(event) => updateField("url", event.target.value)}
          />
        </label>
      </div>

      <p className={styles.duplicateHint}>{he.social.addAccount.duplicatePlatformHint}</p>

      <div className={styles.actions}>
        <SecondaryButton type="button" onClick={resetAndCollapse}>
          {he.social.addAccount.cancel}
        </SecondaryButton>
        <PrimaryButton type="submit" disabled={!canSubmit}>
          {he.social.addAccount.submit}
        </PrimaryButton>
      </div>
    </form>
  );
}
