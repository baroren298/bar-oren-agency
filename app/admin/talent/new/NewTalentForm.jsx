"use client";

/*
 * NewTalentForm — "Add New Talent" sprint.
 *
 * Plain create form (not <ComparisonView> — there is nothing to compare
 * against yet, this is the talent's very first version). Owns all local
 * form state, client-side validation (a fast-feedback mirror of the
 * server's real validation in app/api/admin/talent/route.js — the server
 * is still the actual authority), the POST request, and Hebrew error
 * display.
 *
 * Fields match prisma/schema.prisma's TalentVersion columns exactly,
 * limited to this sprint's "minimum required" scope (see he.talent.create
 * for the explicit, in-UI note on what's deliberately not supported yet:
 * a separate role/title, a short bio/excerpt, and a profile image — none
 * have a column/pipeline to write to today). English-language variants
 * (nameEn/locationEn/bioEn) are intentionally limited to bioEn here, kept
 * minimal per this sprint's "small and focused" scope — nameEn/locationEn
 * can be filled in afterward via the talent's normal Draft editing flow
 * (TalentDetailsEditor), which already supports every TalentVersion field.
 *
 * On success: redirects to /admin/talent/[id] (the new talent's detail
 * page), per this sprint's required behavior.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import PrimaryButton from "@/components/admin/PrimaryButton";
import SecondaryButton from "@/components/admin/SecondaryButton";
import { he } from "@/lib/admin/i18n/he";
import { siteConfig } from "@/data/site";
import styles from "./new-talent.module.css";

const COPY = he.talent.create;
const CATEGORY_OPTIONS = siteConfig.categories.filter((category) => category.key !== "all");

// Mirrors the server's SLUG_PATTERN (app/api/admin/talent/route.js) — a
// fast client-side check only; the server re-validates regardless.
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const EMPTY_FORM = {
  name: "",
  slug: "",
  location: "",
  birthDate: "",
  category: [],
  bioHe: "",
  bioEn: "",
};

export default function NewTalentForm() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  function updateField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setFieldErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  function toggleCategory(key) {
    setForm((previous) => ({
      ...previous,
      category: previous.category.includes(key)
        ? previous.category.filter((c) => c !== key)
        : [...previous.category, key],
    }));
  }

  function validateClientSide() {
    const errors = {};
    if (!form.name.trim()) errors.name = COPY.errors.nameRequired;

    const slug = form.slug.trim().toLowerCase();
    if (!slug) {
      errors.slug = COPY.errors.slugRequired;
    } else if (!SLUG_PATTERN.test(slug)) {
      errors.slug = COPY.errors.slugInvalid;
    }

    if (!form.bioHe.trim()) errors.bioHe = COPY.errors.bioRequired;

    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError(null);

    const errors = validateClientSide();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(COPY.errors.validationSummary);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/talent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim().toLowerCase(),
          location: form.location.trim() || null,
          birthDate: form.birthDate || null,
          category: form.category,
          bioHe: form.bioHe.trim(),
          bioEn: form.bioEn.trim() || null,
        }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFieldErrors(body.fieldErrors || {});
        setFormError(body.error || COPY.errors.serverError);
        setSubmitting(false);
        return;
      }

      setSucceeded(true);
      router.push(`/admin/talent/${body.talent.id}`);
    } catch {
      setFormError(COPY.errors.networkError);
      setSubmitting(false);
    }
  }

  return (
    <form className={`${styles.tokens} ${styles.form}`} onSubmit={handleSubmit}>
      {formError ? (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      ) : null}

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{COPY.fields.name}</span>
          <input
            type="text"
            className={styles.input}
            value={form.name}
            placeholder={COPY.fields.namePlaceholder}
            onChange={(event) => updateField("name", event.target.value)}
          />
          {fieldErrors.name ? <span className={styles.fieldError}>{fieldErrors.name}</span> : null}
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{COPY.fields.slug}</span>
          <input
            type="text"
            dir="ltr"
            className={styles.input}
            value={form.slug}
            placeholder={COPY.fields.slugPlaceholder}
            onChange={(event) => updateField("slug", event.target.value)}
          />
          <span className={styles.fieldHelper}>{COPY.fields.slugHelper}</span>
          {fieldErrors.slug ? <span className={styles.fieldError}>{fieldErrors.slug}</span> : null}
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{COPY.fields.location}</span>
          <input
            type="text"
            className={styles.input}
            value={form.location}
            placeholder={COPY.fields.locationPlaceholder}
            onChange={(event) => updateField("location", event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{COPY.fields.birthDate}</span>
          <input
            type="date"
            className={styles.input}
            value={form.birthDate}
            onChange={(event) => updateField("birthDate", event.target.value)}
          />
          {fieldErrors.birthDate ? (
            <span className={styles.fieldError}>{fieldErrors.birthDate}</span>
          ) : null}
        </label>
      </div>

      <fieldset className={styles.field}>
        <span className={styles.fieldLabel}>{COPY.fields.category}</span>
        <div className={styles.categoryGrid}>
          {CATEGORY_OPTIONS.map((category) => (
            <label key={category.key} className={styles.categoryOption}>
              <input
                type="checkbox"
                checked={form.category.includes(category.key)}
                onChange={() => toggleCategory(category.key)}
              />
              {category.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>{COPY.fields.bioHe}</span>
        <textarea
          className={styles.textarea}
          rows={5}
          value={form.bioHe}
          placeholder={COPY.fields.bioHePlaceholder}
          onChange={(event) => updateField("bioHe", event.target.value)}
        />
        {fieldErrors.bioHe ? <span className={styles.fieldError}>{fieldErrors.bioHe}</span> : null}
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>{COPY.fields.bioEn}</span>
        <textarea
          dir="ltr"
          className={styles.textarea}
          rows={3}
          value={form.bioEn}
          onChange={(event) => updateField("bioEn", event.target.value)}
        />
      </label>

      <div className={styles.unsupportedNote}>
        <p className={styles.unsupportedTitle}>{COPY.unsupportedNote.title}</p>
        <p className={styles.unsupportedDescription}>{COPY.unsupportedNote.description}</p>
      </div>

      <div className={styles.actions}>
        <SecondaryButton type="button" onClick={() => router.push("/admin/talent")}>
          {COPY.cancel}
        </SecondaryButton>
        <PrimaryButton type="submit" disabled={submitting || succeeded}>
          {submitting ? COPY.submitting : succeeded ? COPY.successRedirecting : COPY.submit}
        </PrimaryButton>
      </div>
    </form>
  );
}
