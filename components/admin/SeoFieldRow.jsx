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
 *     bio / profile image / public URL). Shown instead of the bare "לא
 *     קיים" in read-only mode, and as the input's placeholder while
 *     editing, so an empty field honestly reads as "using the automatic
 *     value."
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
 *   - defaultHint (string, optional) — smart-default explanation for an
 *     empty value
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

export default function SeoFieldRow({ field, value, readOnly = false, onChange = () => {}, defaultHint }) {
  const { key, label, type, helper, maxLength, dir } = field;

  if (readOnly) {
    const displayValue = formatReadOnlyValue(field, value);
    const emptyText = defaultHint
      ? `${he.seo.notSet} — ${he.seo.defaults.usingDefault}: ${defaultHint}`
      : he.seo.notSet;
    return (
      <div className={styles.row}>
        <span className={styles.label}>{label}</span>
        <span
          className={displayValue ? styles.readOnlyValue : styles.emptyValue}
          dir={displayValue && dir ? dir : undefined}
        >
          {displayValue || emptyText}
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

  const placeholder = defaultHint ? `${he.seo.defaults.usingDefault}: ${defaultHint}` : undefined;

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
