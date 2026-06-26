"use client";

/*
 * Login form — Phase 2: Auth/Security.
 *
 * Posts to app/api/admin/auth/login/route.js (an explicit route handler,
 * not a Server Action — per the approved Phase 2 plan). On success the
 * server has already set the httpOnly session cookie; this component just
 * redirects. On failure it shows one generic message — never "wrong
 * password" vs "no such user," to avoid leaking which emails exist.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.push("/admin/talent");
        router.refresh();
        return;
      }

      if (res.status === 429) {
        setError("יותר מדי ניסיונות התחברות. נסה שוב בעוד כמה דקות.");
      } else {
        setError("אימייל או סיסמה שגויים.");
      }
    } catch {
      setError("שגיאת תקשורת. נסה שוב.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>כניסת מנהל</h1>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">
            אימייל
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">
            סיסמה
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting ? "מתחבר…" : "התחבר"}
        </button>
      </form>
    </div>
  );
}
