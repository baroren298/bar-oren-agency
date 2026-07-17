/*
 * SeoFieldRow — SEO Editor Foundation sprint, completed by the Talent SEO
 * + Slug Management sprint.
 *
 * A single SEO field inside SeoEditor: label + either a read-only value
 * (published view) or an input/textarea/checkbox (editing view), plus a
 * gentle helper line explaining what the field actually controls. Stays a
 * plain presentational component (no hooks, no "use client") since it never
 * owns any state itself; SeoEditor is the only thing that touches
 * `proposedValues`.
 *
 * Talent SEO + Slug Management sprint additions:
 *   - "boolean" type (seoNoindex): a checkbox row, mirroring
 *     ComparisonView's own boolean field treatment.
 *   - `dir` (from the field registry): URL-valued fields render LTR inside
 *     the RTL admin.
 *   - `defaultHint` (string, optional): what the public site falls back to
 *     when this field is empty (the sprint's smart defaults — talent name /
 *     bio / profile image / public URL). Used as the input's placeholder
 *     while editing, so an empty field honestly reads as "using the
 *     automatic value."
 *
 * SEO effective-value presentation sprint — the read-only view no longer
 * renders "לא קיים — ברירת מחדל אוטומטית: ..." (technically true, but it
 * read like an error). Instead it ALWAYS shows the effective value the
 * public page will actually render, plus a small status badge:
 *   - "מותאם אישית" when a stored custom value exists (the value shown is
 *     the stored one), or
 *   - "אוטומטי" when the field is empty and the smart default applies (the
 *     value shown is `fallbackValue` — resolved by SeoEditor through the
 *     exact same fallback chain lib/public/seo.js applies on the live
 *     page).
 * When there is neither a stored value nor a fallback, a calm "—" renders
 * with no badge. The fallback logic itself is untouched — this is purely
 * presentation.
 *
 * The `maxLength` character count shown here is a *visual guide only* —
 * never an enforced limit.
 *
 * Props:
 *   - field ({ key, label, type, helper, maxLength, dir }) — from
 *     lib/admin/seo-fields.js
 *   - value (string|boolean|string[]|null)
 *   - readOnly (boolean, optional, default false)
 *   - onChange (function, optional) — ignored when readOnly
 *   - defaultHint (string, optional) — smart-default source description,
 *     used as the editing placeholder for an empty value
 *   - fallbackValue (string, optional) — the actual effective value the
 *     public page renders when this field is empty (read-only display)
 */

import styles from "./SeoFieldRow.module.css";
import { he } from "@/lib/admin/i18n/he";

function formatReadOnlyValue(field, value) {
  if (field.type === "boolean") {
    return value ? "כן" : "לא";
  }
  if (field.type === "list") {
    return Array.isArray(value) && value.length ? value.join("، ") : null;
  }
  return value || null;
}

export default function SeoFieldRow({
  field,
  value,
  readOnly = false,
  onChange = () => {},
  defaultHint,
  fallbackValue,
}) {
  const { key, label, type, helper, maxLength, dir } = field;

  if (readOnly) {
    const customValue = formatReadOnlyValue(field, value);

    // Booleans have no smart default — render the plain כן/לא value with
    // no badge, exactly as before.
    if (type === "boolean") {
      return (
        <div className={styles.row}>
          <span className={styles.label}>{label}</span>
          <span className={styles.readOnlyValue}>{customValue}</span>
        </div>
      );
    }

    // Effective value first: the stored custom value when one exists,
    // otherwise the automatic fallback the public page actually renders.
    const effectiveValue = customValue || (fallbackValue ? String(fallbackValue) : null);
    const badge = customValue
      ? { label: he.seo.effective.custom, className: styles.badgeCustom }
      : effectiveValue
        ? { label: he.seo.effective.automatic, className: styles.badgeAuto }
        : null;

    return (
      <div className={styles.row}>
        <span className={styles.label}>{label}</span>
        <span className={styles.valueCell}>
          <span
            className={effectiveValue ? styles.readOnlyValue : styles.emptyValue}
            dir={effectiveValue && dir ? dir : undefined}
          >
            {effectiveValue || he.seo.effective.none}
          </span>
          {badge ? <span className={badge.className}>{badge.label}</span> : null}
        </span>
      </div>
    );
  }

  if (type === "boolean") {
    return (
      <div className={styles.rowEditable}>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={!!value}
            onChange={(event) => onChange(event.target.checked)}
            aria-label={label}
          />
          <span className={styles.labelEditable}>
            <span className={styles.changeDot} aria-hidden="true" />
            {label}
          </span>
        </label>
        {helper ? <p className={styles.helper}>{helper}</p> : null}
      </div>
    );
  }

  const textValue = type === "list" ? (Array.isArray(value) ? value.join(", ") : value ?? "") : value ?? "";

  function handleChange(event) {
    const raw = event.target.value;
    if (type === "list") {
      onChange(
        raw
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      );
    } else {
      onChange(raw);
    }
  }

  // Editing mode: an empty input still honestly reads as "the automatic
  // value applies" via the placeholder — without any "broken"-sounding
  // wording.
  const placeholder = defaultHint ? `${he.seo.effective.automatic}: ${defaultHint}` : undefined;

  return (
    <div className={styles.rowEditable}>
      <label htmlFor={`seo-${key}`} className={styles.labelEditable}>
        <span className={styles.changeDot} aria-hidden="true" />
        {label}
      </label>

      {helper ? <p className={styles.helper}>{helper}</p> : null}

      {type === "textarea" ? (
        <textarea
          id={`seo-${key}`}
          className={styles.textarea}
          value={textValue}
          onChange={handleChange}
          rows={3}
          aria-label={label}
          placeholder={placeholder}
          dir={dir}
        />
      ) : (
        <input
          id={`seo-${key}`}
          type="text"
          className={styles.input}
          value={textValue}
          onChange={handleChange}
          aria-label={label}
          placeholder={placeholder}
          dir={dir}
        />
      )}

      {maxLength ? (
        <span className={styles.charCount}>
          {textValue.length}/{maxLength} {he.seo.charCountSuffix}
        </span>
      ) : null}
    </div>
  );
}
