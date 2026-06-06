'use client';

import { useState, useId } from 'react';
import Link from 'next/link';
import styles from './ContactForm.module.css';

const INITIAL_FIELDS = { name: '', email: '', phone: '', message: '', consent: false, _trap: '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(fields) {
  const errors = {};
  if (!fields.name.trim())               errors.name    = 'נא להזין שם מלא';
  if (!fields.email.trim())              errors.email   = 'נא להזין כתובת אימייל';
  else if (!EMAIL_RE.test(fields.email)) errors.email   = 'כתובת אימייל לא תקינה';
  if (!fields.message.trim())            errors.message = 'נא להזין הודעה';
  if (!fields.consent)                   errors.consent = 'יש לאשר את מדיניות הפרטיות לפני שליחת הטופס.';
  return errors;
}

export default function ContactForm({ title }) {
  const uid = useId();
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
      const next = validate({ ...fields, [name]: newValue });
      setErrors((prev) => ({ ...prev, [name]: next[name] }));
    }
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const next = validate(fields);
    setErrors((prev) => ({ ...prev, [name]: next[name] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const allTouched = { name: true, email: true, phone: true, message: true, consent: true };
    setTouched(allTouched);
    const errs = validate(fields);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setStatus('loading');
    setServerError('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
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
      setServerError('אירעה שגיאה. אנא נסו שוב.');
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
          <p className={styles.successTitle}>ההודעה נשלחה.</p>
          <p className={styles.successBody}>בר אורן ייצור איתכם קשר בהקדם.</p>
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
        aria-label="טופס יצירת קשר"
        className={styles.form}
      >
        {field('name', 'שם מלא', {
          type: 'text',
          autoComplete: 'name',
          placeholder: 'ישראל ישראלי',
        })}

        <div className={styles.twoCol}>
          {field('email', 'אימייל', {
            type: 'email',
            autoComplete: 'email',
            placeholder: 'name@example.com',
            dir: 'ltr',
          })}
          {field('phone', 'טלפון', {
            type: 'tel',
            autoComplete: 'tel',
            placeholder: '050-000-0000',
            dir: 'ltr',
            required: false,
          })}
        </div>

        {field('message', 'הודעה', { placeholder: 'ספרו לנו במה אתם מעוניינים...' })}

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
              אני מאשר/ת את{' '}
              <Link href="/privacy-policy" className={styles.consentLink}>
                מדיניות הפרטיות
              </Link>
              {' '}של האתר ומסכים/ה להעברת פרטיי לצורך יצירת קשר.
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
          {status === 'loading' ? 'שולח...' : 'שלחו הודעה'}
        </button>
      </form>
    </div>
  );
}
