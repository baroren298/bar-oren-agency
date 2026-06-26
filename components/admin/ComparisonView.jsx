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
 * about, contact, footer, ...) — callers just supply a different `fields`
 * array. Each field is { key, label, value, type }, where `type` is one of
 * "text" | "textarea" | "list" | "boolean" ("list" = comma-separated
 * values, e.g. categories/tags).
 *
 * Props:
 *   - fields ({ key, label, value, type }[], required)
 */

import { useState } from "react";
import styles from "./ComparisonView.module.css";

function formatReadOnlyValue(field) {
  const { value, type } = field;

  if (type === "boolean") {
    return value ? "כן" : "לא";
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

export default function ComparisonView({ fields }) {
  const [proposedValues, setProposedValues] = useState(() =>
    fields.reduce((acc, field) => {
      acc[field.key] = field.value;
      return acc;
    }, {})
  );

  function handleChange(key, value) {
    setProposedValues((previous) => ({ ...previous, [key]: value }));
  }

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

          <div className={styles.fieldList}>
            {fields.map((field) => (
              <div key={field.key} className={styles.fieldRow}>
                <span className={styles.fieldLabel}>{field.label}</span>
                <span className={styles.readOnlyValue}>{formatReadOnlyValue(field)}</span>
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

          <div className={styles.fieldList}>
            {fields.map((field) => (
              <div key={field.key} className={styles.fieldRowEditable}>
                <label htmlFor={`proposed-${field.key}`} className={styles.proposedFieldLabel}>
                  {/*
                   * Inert placeholder for a future "this field was changed"
                   * indicator. Purely visual — no diffing against the
                   * published value happens here or anywhere in this
                   * component yet.
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
        </section>
      </div>
    </div>
  );
}
