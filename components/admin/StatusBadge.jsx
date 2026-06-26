/*
 * StatusBadge — Admin Design System Foundation.
 *
 * Small pill for showing a record's status/lifecycle state — e.g. the
 * talent list's `status`, `hasPublishedVersion`, `hasPendingChanges`
 * fields (app/admin/talent/page.jsx) today, and similar status/lifecycle
 * fields on Proposals, Media, etc. later. Purely a label + color
 * treatment; carries no business logic about what counts as "success" or
 * "warning" — the caller decides via `tone`.
 *
 * Props:
 *   - label (string, required) — the text shown
 *   - tone ("neutral" | "success" | "warning" | "info" | "danger",
 *     optional, default "neutral")
 */

import styles from "./StatusBadge.module.css";

const TONE_CLASS = {
  neutral: "toneNeutral",
  success: "toneSuccess",
  warning: "toneWarning",
  info: "toneInfo",
  danger: "toneDanger",
};

export default function StatusBadge({ label, tone = "neutral" }) {
  const toneClass = styles[TONE_CLASS[tone] || TONE_CLASS.neutral];

  return (
    <span className={`${styles.tokens} ${styles.badge} ${toneClass}`}>{label}</span>
  );
}
