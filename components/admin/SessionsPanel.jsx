/*
 * SessionsPanel — Sprint 3c (Session Management UI).
 *
 * Purely presentational: every piece of state it needs (the session list,
 * the load/action status, which dialog if any is open, whether a confirm
 * is in flight) arrives as props from SessionsSection.jsx. No fetch, no
 * hooks, no "use client" directive — same reason PrimaryButton/
 * SecondaryButton don't have one: a component with no hooks or
 * browser-only APIs can render from anywhere, and keeping it prop-driven
 * is what lets the whole "list render / current badge / empty / loading /
 * failure / dialog / disabled+pending" state space be covered by
 * renderToString snapshots (see __tests__/sessionsPanel.test.jsx) in a
 * repo whose vitest setup has no DOM (no jsdom, no @testing-library) —
 * the same split already used for the flow logic in lib/admin/ui/
 * sessionsState.js.
 *
 * Only fields already approved for display are ever rendered: createdAt,
 * expiresAt, isCurrent. Session ids are read from props only to build a
 * React `key` and as the opaque target passed back through
 * onRequestRevokeOne — they are never interpolated into any visible text,
 * aria-label, title, or data attribute.
 *
 * Props:
 *   - status ("loading" | "ready" | "error", required)
 *   - sessions (array of { id, createdAt, expiresAt, isCurrent }, required)
 *   - loadError (string | null) — semantic code from sessionsState.js
 *   - isSelfView (boolean, required) — is the acting Owner viewing their
 *     own user record? Decides the revoke-all label/copy variant.
 *   - dialog (null | { type: "one", sessionId } | { type: "all" })
 *   - confirming (boolean)
 *   - actionError (string | null) — semantic code from sessionsState.js
 *   - onRequestRevokeOne(sessionId), onRequestRevokeAll(), onConfirm(),
 *     onCancel() (functions, required)
 */

import Card from "./Card";
import StatusBadge from "./StatusBadge";
import SecondaryButton from "./SecondaryButton";
import ConfirmDialog from "./ConfirmDialog";
import { he } from "@/lib/admin/i18n/he";
import styles from "./SessionsPanel.module.css";

const COPY = he.users.detail.sessions;
const GENERIC_ERRORS = he.users.errors;

const LIST_ERROR_COPY = {
  UNAUTHORIZED: GENERIC_ERRORS.notAuthenticated,
  FORBIDDEN: GENERIC_ERRORS.notOwner,
  GENERIC: GENERIC_ERRORS.serverError,
};

const ACTION_ERROR_COPY = {
  UNAUTHORIZED: GENERIC_ERRORS.notAuthenticated,
  FORBIDDEN: GENERIC_ERRORS.notOwner,
  CANNOT_REVOKE_CURRENT: COPY.errors.cannotRevokeCurrent,
  SESSION_GONE: COPY.errors.sessionGone,
  GENERIC: GENERIC_ERRORS.serverError,
};

function formatDateTime(value) {
  if (!value) return he.users.table.never;
  try {
    return new Date(value).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return he.users.table.never;
  }
}

export default function SessionsPanel({
  status,
  sessions,
  loadError,
  isSelfView,
  dialog,
  confirming,
  actionError,
  onRequestRevokeOne,
  onRequestRevokeAll,
  onConfirm,
  onCancel,
}) {
  const dialogOpen = Boolean(dialog);
  const dialogIsAll = dialog?.type === "all";

  const dialogTitle = dialogIsAll
    ? isSelfView
      ? COPY.confirmAllSelf.title
      : COPY.confirmAllOther.title
    : COPY.confirmOne.title;

  const dialogBody = dialogIsAll
    ? isSelfView
      ? COPY.confirmAllSelf.body
      : COPY.confirmAllOther.body
    : COPY.confirmOne.body;

  const dialogConfirmingLabel = dialogIsAll ? COPY.revokingAll : COPY.revokingOne;
  const dialogErrorText = actionError ? ACTION_ERROR_COPY[actionError] || ACTION_ERROR_COPY.GENERIC : null;

  return (
    <Card title={he.users.detail.sections.sessions}>
      <p className={styles.description}>{COPY.description}</p>

      {status === "loading" ? (
        <p className={styles.statusText} role="status" aria-live="polite">
          {COPY.loading}
        </p>
      ) : null}

      {status === "error" ? (
        <p className={styles.formError} role="alert">
          {LIST_ERROR_COPY[loadError] || LIST_ERROR_COPY.GENERIC}
        </p>
      ) : null}

      {status === "ready" && sessions.length === 0 ? (
        <p className={styles.statusText}>{COPY.empty}</p>
      ) : null}

      {status === "ready" && sessions.length > 0 ? (
        <ul className={styles.list}>
          {sessions.map((session) => {
            const createdLabel = formatDateTime(session.createdAt);
            const expiresLabel = formatDateTime(session.expiresAt);

            return (
              <li key={session.id} className={styles.row}>
                <div className={styles.rowInfo}>
                  <div className={styles.rowField}>
                    <span className={styles.rowFieldLabel}>{COPY.fields.createdAt}</span>
                    <span className={styles.rowFieldValue}>{createdLabel}</span>
                  </div>
                  <div className={styles.rowField}>
                    <span className={styles.rowFieldLabel}>{COPY.fields.expiresAt}</span>
                    <span className={styles.rowFieldValue}>{expiresLabel}</span>
                  </div>
                  {session.isCurrent ? (
                    <StatusBadge label={COPY.currentBadge} tone="info" />
                  ) : null}
                </div>

                <div className={styles.rowActions}>
                  {session.isCurrent ? (
                    <p className={styles.mutedNote}>{COPY.currentHint}</p>
                  ) : (
                    <SecondaryButton
                      type="button"
                      onClick={() => onRequestRevokeOne(session.id)}
                      disabled={confirming}
                      aria-label={`${COPY.revokeOne} — ${createdLabel}`}
                    >
                      {COPY.revokeOne}
                    </SecondaryButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {status === "ready" && sessions.length > 0 ? (
        <div className={styles.formActions}>
          <SecondaryButton type="button" onClick={onRequestRevokeAll} disabled={confirming}>
            {isSelfView ? COPY.revokeAllSelf : COPY.revokeAllOther}
          </SecondaryButton>
        </div>
      ) : null}

      <ConfirmDialog
        open={dialogOpen}
        title={dialogTitle}
        body={dialogBody}
        confirmLabel={dialogIsAll ? (isSelfView ? COPY.revokeAllSelf : COPY.revokeAllOther) : COPY.revokeOne}
        confirmingLabel={dialogConfirmingLabel}
        cancelLabel={COPY.confirmCancelLabel}
        onConfirm={onConfirm}
        onCancel={onCancel}
        confirming={confirming}
        error={dialogErrorText}
      />
    </Card>
  );
}
