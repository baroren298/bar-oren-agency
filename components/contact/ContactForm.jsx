'use client';

import { useState, useId } from 'react';
import Link from 'next/link';
import { getStrings, localizeHref } from '@/lib/i18n';
import styles from './ContactForm.module.css';

const INITIAL_FIELDS = { name: '', email: '', phone: '', message: '', consent: false, _trap: '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* errs: same shared error copy used by the API route (data/i18n/strings.js),
   so client-side and server-side validation always say the same thing in
   the same locale. */
function validate(fields, errs) {
  const errors = {};
  if (!fields.name.trim())               errors.name    = errs.name;
  if (!fields.email.trim())              errors.email   = errs.email;
  else if (!EMAIL_RE.test(fields.email)) errors.email   = errs.emailInvalid;
  if (!fields.message.trim())            errors.message = errs.message;
  if (!fields.consent)                   errors.consent = errs.consent;
  return errors;
}

export default function ContactForm({ title, locale = 'he' }) {
  const uid = useId();
  const t = getStrings(locale).contact.form;
  const errorCopy = t.errors;
  const [fields, setFields]   = useState(INITIAL_FIELDS);
  const [errors, setErrors]   = useState({});
  const [touched, setTouched] = useState({});
  const [status, setStatus]   = useState('idle'); // idle | loading | success | error
  const [serverError, setServerError] = useState('');

  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    setFields((prev) => ({ ...prev, [name]: newValue }));
    /* Clear field error as user corrects it */
    if (touched[name]) {
      const next = validate({ ...fields, [name]: newValue }, errorCopy);
      setErrors((prev) => ({ ...prev, [name]: next[name] }));
    }
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const next = validate(fields, errorCopy);
    setErrors((prev) => ({ ...prev, [name]: next[name] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const allTouched = { name: true, email: true, phone: true, message: true, consent: true };
    setTouched(allTouched);
    const fieldErrors = validate(fields, errorCopy);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setStatus('loading');
    setServerError('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, locale }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        if (data.error)  setServerError(data.error);
        setStatus('idle');
        return;
      }

      setStatus('success');
      setFields(INITIAL_FIELDS);
      setTouched({});
      setErrors({});
    } catch {
      setServerError(errorCopy.network);
      setStatus('idle');
    }
  };

  /* ── Field helper ── */
  const field = (name, label, inputProps = {}) => {
    const id    = `${uid}-${name}`;
    const errId = `${uid}-${name}-err`;
    const hasErr = touched[name] && errors[name];

    return (
      <div className={styles.fieldGroup}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {inputProps.required !== false && <span className={styles.required} aria-hidden="true">*</span>}
        </label>
        {name === 'message' ? (
          <textarea
            id={id}
            name={name}
            rows={5}
            value={fields[name]}
            onChange={handleChange}
            onBlur={handleBlur}
            aria-describedby={hasErr ? errId : undefined}
            aria-invalid={hasErr ? 'true' : undefined}
            className={`${styles.input} ${styles.textarea} ${hasErr ? styles.inputError : ''}`}
            disabled={status === 'loading'}
            required={inputProps.required !== false}
            {...inputProps}
          />
        ) : (
          <input
            id={id}
            name={name}
            value={fields[name]}
            onChange={handleChange}
            onBlur={handleBlur}
            aria-describedby={hasErr ? errId : undefined}
            aria-invalid={hasErr ? 'true' : undefined}
            className={`${styles.input} ${hasErr ? styles.inputError : ''}`}
            disabled={status === 'loading'}
            required={inputProps.required !== false}
            {...inputProps}
          />
        )}
        {hasErr && (
          <p id={errId} className={styles.errorMsg} role="alert">
            {errors[name]}
          </p>
        )}
      </div>
    );
  };

  if (status === 'success') {
    return (
      <div className={styles.wrapper} aria-live="polite">
        <p className={styles.sectionLabel}>{title}</p>
        <div className={styles.successBlock}>
          <p className={styles.successIcon} aria-hidden="true">✓</p>
          <p className={styles.successTitle}>{t.success.title}</p>
          <p className={styles.successBody}>{t.success.body}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <p className={styles.sectionLabel}>{title}</p>

      <form
        onSubmit={handleSubmit}
        noValidate
        aria-label={t.ariaLabel}
        className={styles.form}
      >
        {field('name', t.labels.name, {
          type: 'text',
          autoComplete: 'name',
          placeholder: t.placeholders.name,
        })}

        <div className={styles.twoCol}>
          {field('email', t.labels.email, {
            type: 'email',
            autoComplete: 'email',
            placeholder: t.placeholders.email,
            dir: 'ltr',
          })}
          {field('phone', t.labels.phone, {
            type: 'tel',
            autoComplete: 'tel',
            placeholder: t.placeholders.phone,
            dir: 'ltr',
            required: false,
          })}
        </div>

        {field('message', t.labels.message, { placeholder: t.placeholders.message })}

        {/* Honeypot — visually hidden, bots fill it, humans never see it */}
        <input
          type="text"
          name="_trap"
          value={fields._trap}
          onChange={handleChange}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className={styles.honeypot}
        />

        {/* ── Privacy consent ── */}
        <div className={styles.consentGroup}>
          <div className={styles.consentRow}>
            <input
              type="checkbox"
              id={`${uid}-consent`}
              name="consent"
              checked={fields.consent}
              onChange={handleChange}
              onBlur={handleBlur}
              aria-describedby={touched.consent && errors.consent ? `${uid}-consent-err` : undefined}
              aria-invalid={touched.consent && errors.consent ? 'true' : undefined}
              className={`${styles.checkbox} ${touched.consent && errors.consent ? styles.checkboxError : ''}`}
              required
            />
            <label htmlFor={`${uid}-consent`} className={styles.consentLabel}>
              {t.consent.prefix}{' '}
              <Link href={localizeHref('/privacy-policy', locale)} className={styles.consentLink}>
                {t.consent.linkText}
              </Link>
              {' '}{t.consent.suffix}
            </label>
          </div>
          {touched.consent && errors.consent && (
            <p id={`${uid}-consent-err`} className={styles.errorMsg} role="alert">
              {errors.consent}
            </p>
          )}
        </div>

        {serverError && (
          <p className={styles.serverError} role="alert">{serverError}</p>
        )}

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={status === 'loading'}
          aria-busy={status === 'loading'}
        >
          {status === 'loading' ? t.submitting : t.submit}
        </button>
      </form>
    </div>
  );
}
