/*
 * SeoFieldRow — SEO Editor Foundation sprint.
 *
 * A single SEO field inside SeoEditor: label + either a read-only value
 * (published column) or an input/textarea (proposed column), plus a
 * gentle helper line explaining what the field actually controls. Mirrors
 * SocialLinkRow's role inside SocialLinksEditor and ComparisonView's
 * per-field-row layout — the one piece that knows how to render a single
 * SEO field — but stays a plain presentational component (no hooks, no
 * "use client") since it never owns any state itself; SeoEditor is the
 * only thing that touches `proposedValues`.
 *
 * Entity-agnostic on purpose, same reasoning as SocialLinkRow: this file
 * knows nothing about "talent" specifically, only a `field`
 * ({ key, label, type, helper, maxLength }) and a value, so the same row
 * backs talent SEO, homepage SEO, or any other page's SEO later — only the
 * `groups` array passed into SeoEditor changes.
 *
 * The `maxLength` character count shown here is a *visual guide only* —
 * "42/60 תווים" — never an enforced limit, never real SEO scoring, per
 * this sprint's explicit "no real validation" scope.
 *
 * Props:
 *   - field ({ key, label, type, helper, maxLength }) — from
 *     lib/admin/seo-fields.js
 *   - value (string|string[]|null)
 *   - readOnly (boolean, optional, default false)
 *   - onChange (function, optional) — (value: string|string[]) => void,
 *     ignored when readOnly
 */

import styles from "./SeoFieldRow.module.css";
import { he } from "@/lib/admin/i18n/he";

function formatReadOnlyValue(field, value) {
  if (field.type === "list") {
    return Array.isArray(value) && value.length ? value.join("، ") : null;
  }
  return value || null;
}

export default function SeoFieldRow({ field, value, readOnly = false, onChange = () => {} }) {
  const { key, label, type, helper, maxLength } = field;

  if (readOnly) {
    const displayValue = formatReadOnlyValue(field, value);
    return (
      <div className={styles.row}>
        <span className={styles.label}>{label}</span>
        <span className={displayValue ? styles.readOnlyValue : styles.emptyValue}>
          {displayValue || he.seo.notSet}
        </span>
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
        />
      ) : (
        <input
          id={`seo-${key}`}
          type="text"
          className={styles.input}
          value={textValue}
          onChange={handleChange}
          aria-label={label}
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
