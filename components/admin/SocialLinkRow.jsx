/*
 * SocialLinkRow → SocialAccountCard — Social Links Editor Foundation
 * sprint, redesigned for multi-account support by the Socials Tab
 * Multi-Account UI sprint, restyled by the Socials Tab Visual Polish
 * sprint.
 *
 * Visual Polish sprint — presentation only, same as ComparisonView's own
 * "UX Polish" follow-up: no prop, state, or behavior changed here, only
 * how one account renders. Was a self-contained bordered/shadowed "card"
 * per account, with a select/badge floating to the right of the header and
 * an absolutely-positioned "לא נשמר" pill — visually unlike every other
 * admin tab. Is now a small field group that reuses ComparisonView's own
 * grid language (a fixed-width label column + a value column, the same
 * `.fieldRow`/`.fieldRowEditable` shape Details already uses) so a list of
 * accounts reads like the rest of the CMS, not a one-off widget:
 *
 *   platform (group heading)
 *     ↓
 *   סוג חשבון (account type)
 *     ↓
 *   [תווית מותאמת — only when type is "אחר"]
 *     ↓
 *   שם משתמש (handle)
 *     ↓
 *   קישור (url)
 *     ↓
 *   תצוגה מקדימה (preview) — small, muted, never bold/colored
 *
 * The previously-reserved "open link / copy link" placeholder buttons are
 * removed: they were always `disabled` with a "coming soon" tooltip (pure
 * visual noise, zero functionality), and removing an inert disabled button
 * doesn't change what this component can do. If that affordance gets built
 * for real in a future sprint, it has the same field-row to land in.
 *
 * Handle/url/preview are Latin-script values rendered inside an RTL (Hebrew)
 * page — without `dir="ltr"` a value like "@almavay" can visually reorder
 * to "almavay@". Every place one of those three appears (read-only text,
 * input, or preview line) is wrapped/marked `dir="ltr"` for that reason.
 *
 * Props (unchanged):
 *   - account ({ platform, label, customLabel, handle, url })
 *   - readOnly (boolean, optional, default false)
 *   - onChange (function, optional) — (field, value) => void, ignored when
 *     readOnly. field is one of "label" | "customLabel" | "handle" | "url".
 *   - showNotSavedBadge (boolean, optional, default false) — still shown,
 *     just as a small muted inline note next to the platform name now
 *     instead of a colored pill stacked on top of the card.
 */

import styles from "./SocialLinkRow.module.css";
import { he } from "@/lib/admin/i18n/he";
import { getPlatformEntry, SOCIAL_ACCOUNT_LABELS } from "@/lib/admin/social-platforms";

/**
 * Strips every leading "@" off a handle, e.g. "@@almavay" -> "almavay",
 * "@almavay" -> "almavay", "almavay" -> "almavay". The one normalization
 * primitive everything below builds on.
 */
function stripLeadingAt(handle) {
  if (!handle) return handle;
  return handle.replace(/^@+/, "");
}

/**
 * Read-only / preview display form — always exactly one leading "@", no
 * matter how the value happens to be stored ("almavay", "@almavay", or a
 * defensively-handled "@@almavay" all become "@almavay"). Used by
 * buildPreview below and by the Handle field's read-only (Published) text.
 * Display-only: the stored handle itself is never modified.
 */
function normalizeHandleDisplay(handle) {
  if (!handle) return handle;
  return `@${stripLeadingAt(handle)}`;
}

function buildPreview(handle, url) {
  if (handle) return normalizeHandleDisplay(handle);
  if (url) {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
      return `${parsed.hostname.replace(/^www\./, "")}${path}`;
    } catch {
      return url;
    }
  }
  return null;
}

export default function SocialLinkRow({
  account,
  readOnly = false,
  onChange = () => {},
  showNotSavedBadge = false,
}) {
  const { platform, label, customLabel, handle, url } = account;
  const platformEntry = getPlatformEntry(platform);
  const platformLabel = platformEntry?.label || platform;
  const platformIcon = platformEntry?.icon || "🔗";
  const labelText = he.social.labels[label] || label;
  const preview = buildPreview(handle, url);
  const isOther = label === "OTHER";

  const fieldRowClass = readOnly ? styles.fieldRow : styles.fieldRowEditable;

  return (
    <div className={styles.accountGroup}>
      <div className={styles.accountHeader}>
        <span className={styles.platformIcon} aria-hidden="true">
          {platformIcon}
        </span>
        <span className={styles.platformName}>{platformLabel}</span>
        {showNotSavedBadge ? <span className={styles.notSavedHint}>{he.social.previewBadge}</span> : null}
      </div>

      <div className={styles.fieldList}>
        <div className={fieldRowClass}>
          <span className={styles.fieldLabel}>{he.social.fields.label}</span>
          {readOnly ? (
            <span className={styles.readOnlyValue}>{labelText}</span>
          ) : (
            <select
              className={styles.select}
              value={label}
              onChange={(event) => onChange("label", event.target.value)}
              aria-label={he.social.fields.label}
            >
              {SOCIAL_ACCOUNT_LABELS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {isOther ? (
          <div className={fieldRowClass}>
            <span className={styles.fieldLabel}>{he.social.fields.customLabel}</span>
            {readOnly ? (
              <span className={customLabel ? styles.readOnlyValue : styles.emptyValue}>
                {customLabel || he.social.notSet}
              </span>
            ) : (
              <input
                type="text"
                className={styles.input}
                value={customLabel ?? ""}
                placeholder={he.social.fields.customLabelPlaceholder}
                onChange={(event) => onChange("customLabel", event.target.value)}
                aria-label={he.social.fields.customLabel}
              />
            )}
          </div>
        ) : null}

        <div className={fieldRowClass}>
          <span className={styles.fieldLabel}>{he.social.fields.handle}</span>
          {readOnly ? (
            <span dir="ltr" className={handle ? styles.readOnlyValueLtr : styles.emptyValue}>
              {normalizeHandleDisplay(handle) || he.social.notSet}
            </span>
          ) : (
            <input
              type="text"
              dir="ltr"
              className={`${styles.input} ${styles.inputLtr}`}
              value={stripLeadingAt(handle) ?? ""}
              placeholder={he.social.fields.handlePlaceholder}
              // Employees work with the username only here — any leading
              // "@" typed or pasted (including doubled, "@@almavay") is
              // stripped immediately, so the field never shows or stores
              // (locally) a "@"-prefixed value. The Preview row below still
              // renders it with exactly one "@" via normalizeHandleDisplay.
              onChange={(event) => onChange("handle", stripLeadingAt(event.target.value))}
              aria-label={he.social.fields.handle}
            />
          )}
        </div>

        <div className={fieldRowClass}>
          <span className={styles.fieldLabel}>{he.social.fields.url}</span>
          {readOnly ? (
            <span dir="ltr" className={url ? styles.readOnlyValueLtr : styles.emptyValue}>
              {url || he.social.notSet}
            </span>
          ) : (
            <input
              type="text"
              dir="ltr"
              className={`${styles.input} ${styles.inputLtr}`}
              value={url ?? ""}
              placeholder={he.social.fields.urlPlaceholder}
              onChange={(event) => onChange("url", event.target.value)}
              aria-label={he.social.fields.url}
            />
          )}
        </div>

        <div className={styles.previewRow}>
          <span className={styles.fieldLabel}>{he.social.fields.preview}</span>
          <span dir="ltr" className={preview ? styles.previewValue : styles.emptyValue}>
            {preview || he.social.noPreview}
          </span>
        </div>
      </div>
    </div>
  );
}
