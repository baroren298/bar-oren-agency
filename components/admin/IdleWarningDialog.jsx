"use client";

/*
 * IdleWarningDialog — Sprint 4 (Admin Idle Timeout & Automatic Logout).
 *
 * Purely presentational (mirrors ConfirmDialog.jsx's split: this component
 * owns rendering + focus management only; AdminIdleTimeoutManager.jsx owns
 * all timer/network logic and passes in countdownSeconds/onStay/onLogoutNow).
 *
 * Accessibility (policy §8):
 *   - role="alertdialog" (not plain "dialog") — this is a time-sensitive
 *     security interruption, not a routine confirmation.
 *   - aria-labelledby/aria-describedby point at the title and the STATIC
 *     body sentence only. The ticking countdown number lives in its own
 *     span with no aria-live attribute, so it is never re-announced every
 *     second — only the dialog's one-time appearance (title + body) is
 *     announced, matching "Countdown updates must not create excessive
 *     screen-reader announcements."
 *   - Focus moves to the primary "הישאר מחובר" button on mount and is
 *     restored to whatever had focus before the dialog appeared, on
 *     unmount/close.
 *   - Escape is deliberately NOT handled here. Unlike ConfirmDialog (where
 *     Escape cancels), this dialog has no local keydown handler at all —
 *     Escape is just another keydown that reaches
 *     AdminIdleTimeoutManager's document-level activity listener the same
 *     as any other key, resetting the timer exactly like "הישאר מחובר"
 *     would. That is an explicit, tested design choice (see
 *     lib/admin/ui/idleTimeout.js's header comment): it must never be a
 *     silent, timer-bypassing "close" shortcut.
 *
 * Props:
 *   - countdownSeconds (number, required) — seconds remaining, ceiling'd,
 *     never negative (see getCountdownSeconds in idleTimeout.js).
 *   - onStay (function, required) — "הישאר מחובר"
 *   - onLogoutNow (function, required) — "התנתק עכשיו"
 */

import { useEffect, useRef } from "react";
import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";
import { he } from "@/lib/admin/i18n/he";
import styles from "./IdleWarningDialog.module.css";

const COPY = he.idleTimeout;

export default function IdleWarningDialog({ countdownSeconds, onStay, onLogoutNow }) {
  const stayButtonRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    previouslyFocusedRef.current =
      typeof document !== "undefined" ? document.activeElement : null;
    stayButtonRef.current?.focus();

    return () => {
      const previous = previouslyFocusedRef.current;
      if (previous && typeof previous.focus === "function" && document.contains(previous)) {
        previous.focus();
      }
    };
  }, []);

  return (
    <div className={`${styles.tokens} ${styles.overlay}`} role="presentation">
      <div
        className={styles.panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-warning-title"
        aria-describedby="idle-warning-body"
      >
        <h2 id="idle-warning-title" className={styles.title}>
          {COPY.title}
        </h2>
        <p id="idle-warning-body" className={styles.body}>
          {COPY.body}
        </p>
        <p className={styles.countdown} aria-hidden="false">
          {countdownSeconds}
          <span className={styles.countdownUnit}>{COPY.countdownUnit}</span>
        </p>
        <div className={styles.actions}>
          <SecondaryButton type="button" onClick={onLogoutNow}>
            {COPY.logoutNow}
          </SecondaryButton>
          <PrimaryButton type="button" ref={stayButtonRef} onClick={onStay}>
            {COPY.stayLoggedIn}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
