"use client";

/*
 * NewTalentForm — Add New Talent flow, revised per product decision:
 * creating a talent must NOT publish it directly, and this form is
 * deliberately reduced to the three true initial fields a talent record
 * needs to exist at all: Hebrew name, English name, and slug.
 *
 * Plain create form (not <ComparisonView> — there is nothing to compare
 * against yet, this is the talent's very first version, created as a
 * DRAFT). Owns all local form state, client-side validation (a
 * fast-feedback mirror of the server's real validation in
 * app/api/admin/talent/route.js — the server is still the actual
 * authority), the POST request, and Hebrew error display.
 *
 * Category, location, birth date, and Hebrew/English bio are no longer
 * collected here — they, along with gallery/socials/SEO, are filled in
 * afterward on the talent's detail page (TalentDetailsEditor), which
 * already supports every TalentVersion field. Only after that does the
 * normal Draft -> Proposed -> Approve -> Publish workflow apply.
 *
 * On success: redirects to /admin/talent/[id] (the new talent's detail
 * page), per the product decision.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import PrimaryButton from "@/components/admin/PrimaryButton";
import SecondaryButton from "@/components/admin/SecondaryButton";
import { he } from "@/lib/admin/i18n/he";
import styles from "./new-talent.module.css";

const COPY = he.talent.create;

// Mirrors the server's SLUG_PATTERN (app/api/admin/talent/route.js) — a
// fast client-side check only; the server re-validates regardless.
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const EMPTY_FORM = {
  name: "",
  nameEn: "",
  slug: "",
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

  function validateClientSide() {
    const errors = {};
    if (!form.name.trim()) errors.name = COPY.errors.nameRequired;

    const slug = form.slug.trim().toLowerCase();
    if (!slug) {
      errors.slug = COPY.errors.slugRequired;
    } else if (!SLUG_PATTERN.test(slug)) {
      errors.slug = COPY.errors.slugInvalid;
    }

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
          nameEn: form.nameEn.trim() || null,
          slug: form.slug.trim().toLowerCase(),
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
          <span className={styles.fieldLabel}>{COPY.fields.nameEn}</span>
          <input
            type="text"
            dir="ltr"
            className={styles.input}
            value={form.nameEn}
            placeholder={COPY.fields.nameEnPlaceholder}
            onChange={(event) => updateField("nameEn", event.target.value)}
          />
          {fieldErrors.nameEn ? <span className={styles.fieldError}>{fieldErrors.nameEn}</span> : null}
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
          {form.slug.trim() ? (
            <span className={styles.slugPreview} dir="ltr">
              {COPY.fields.slugPreviewPrefix}
              {form.slug.trim().toLowerCase()}
            </span>
          ) : null}
          {fieldErrors.slug ? <span className={styles.fieldError}>{fieldErrors.slug}</span> : null}
        </label>
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
