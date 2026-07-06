"use client";

/*
 * UserDetailClient — Sprint 3.1: User Details Page.
 *
 * The interactive body of /admin/users/[id]: four Card sections (Profile,
 * Role & permissions, Security, Status), each a focused piece of this
 * user's account rather than one big form — matching the product decision
 * that opening "edit user" should feel like a real management screen, not
 * the old narrow inline row edit.
 *
 * Every write goes through fetch() to the existing/new /api/admin/users
 * routes, then router.refresh() to re-read the server-side user prop from
 * page.jsx — same pattern as UsersPageClient.jsx (no client-side DB/service
 * access of any kind):
 *   - Profile displayName edit  -> PATCH /api/admin/users/[id]
 *   - Status activate/deactivate -> PATCH /api/admin/users/[id]
 *   - Security password reset  -> POST /api/admin/users/[id]/password
 *
 * Role & permissions is deliberately read-only — see he.js's
 * he.users.detail.role.readOnlyNote (rendered below) for why role editing
 * is a follow-up, not part of this sprint.
 *
 * Status section reuses the exact same two safety rules
 * userService.setActive already enforces server-side (never disable the
 * only active Owner, never disable your own account): this component
 * simply never renders the deactivate control for an OWNER row at all
 * (isOwnerRow), the same "make it true by construction in the UI, on top of
 * — not instead of — the server-side check" approach UsersPageClient.jsx
 * already uses. Since this page is Owner-only and an Owner's own row is
 * always role OWNER, hiding the control for every OWNER row also covers
 * the self-disable case without a separate isSelf check.
 *
 * Props:
 *   - user (object, required) — from userService.getUserDetail(), see
 *     page.jsx. { id, email, role, displayName, isActive, lastLoginAt,
 *     createdAt }
 *
 * No currentUserId prop: unlike UsersPageClient.jsx (which shows a "(you)"
 * tag on the acting Owner's own row in a list of many), isOwnerRow alone
 * already fully covers the self-disable safety rule here (this page is
 * Owner-only, and the acting Owner's own row is always role OWNER) — see
 * the Status section below.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/admin/Card";
import PrimaryButton from "@/components/admin/PrimaryButton";
import SecondaryButton from "@/components/admin/SecondaryButton";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import StatusBadge from "@/components/admin/StatusBadge";
import { he } from "@/lib/admin/i18n/he";
import { ROLE } from "@/lib/admin/constants/enums";
import styles from "./user-detail.module.css";

const COPY = he.users;

function formatDateTime(value) {
  if (!value) return COPY.table.never;
  try {
    return new Date(value).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return COPY.table.never;
  }
}

export default function UserDetailClient({ user }) {
  const router = useRouter();
  const isOwnerRow = user.role === ROLE.OWNER;

  // Profile section — displayName edit
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameValue, setDisplayNameValue] = useState(user.displayName || "");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayNameError, setDisplayNameError] = useState(null);

  function startEditingDisplayName() {
    setDisplayNameValue(user.displayName || "");
    setDisplayNameError(null);
    setEditingDisplayName(true);
  }

  function cancelEditingDisplayName() {
    setEditingDisplayName(false);
    setDisplayNameValue(user.displayName || "");
    setDisplayNameError(null);
  }

  async function saveDisplayName() {
    setSavingDisplayName(true);
    setDisplayNameError(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayNameValue }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setDisplayNameError(body.error || COPY.errors.serverError);
        setSavingDisplayName(false);
        return;
      }

      setSavingDisplayName(false);
      setEditingDisplayName(false);
      router.refresh();
    } catch {
      setDisplayNameError(COPY.errors.networkError);
      setSavingDisplayName(false);
    }
  }

  // Security section — password reset
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [resetFieldError, setResetFieldError] = useState(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  async function handleResetPassword(event) {
    event.preventDefault();
    setResetError(null);
    setResetFieldError(null);
    setResetSuccess(false);
    setResettingPassword(true);

    try {
      const response = await fetch(`/api/admin/users/${user.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temporaryPassword: newPassword }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setResetFieldError(body.fieldErrors?.temporaryPassword || null);
        setResetError(body.error || COPY.errors.serverError);
        setResettingPassword(false);
        return;
      }

      setResettingPassword(false);
      setNewPassword("");
      setResetSuccess(true);
    } catch {
      setResetError(COPY.errors.networkError);
      setResettingPassword(false);
    }
  }

  // Status section — activate/deactivate (mirrors UsersPageClient.jsx's toggle)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [dialogError, setDialogError] = useState(null);

  function openToggleDialog() {
    setDialogOpen(true);
    setDialogError(null);
  }

  function closeToggleDialog() {
    if (confirming) return;
    setDialogOpen(false);
    setDialogError(null);
  }

  async function confirmToggle() {
    setConfirming(true);
    setDialogError(null);

    const nextActive = !user.isActive;

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setDialogError(body.error || COPY.errors.serverError);
        setConfirming(false);
        return;
      }

      setConfirming(false);
      setDialogOpen(false);
      router.refresh();
    } catch {
      setDialogError(COPY.errors.networkError);
      setConfirming(false);
    }
  }

  return (
    <div className={styles.tokens}>
      {/* Profile */}
      <Card title={COPY.detail.sections.profile}>
        <p className={styles.sectionDescription}>{COPY.detail.profile.description}</p>

        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>{COPY.detail.fields.email}</span>
          <span className={styles.fieldValue} dir="ltr">
            {user.email}
          </span>
        </div>

        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>{COPY.detail.fields.displayName}</span>
          {editingDisplayName ? (
            <div className={styles.editRow}>
              <input
                type="text"
                className={styles.inlineInput}
                value={displayNameValue}
                onChange={(event) => setDisplayNameValue(event.target.value)}
                disabled={savingDisplayName}
              />
              <button type="button" className={styles.linkButton} onClick={saveDisplayName} disabled={savingDisplayName}>
                {savingDisplayName ? COPY.editDisplayName.saving : COPY.editDisplayName.save}
              </button>
              <button
                type="button"
                className={styles.linkButton}
                onClick={cancelEditingDisplayName}
                disabled={savingDisplayName}
              >
                {COPY.editDisplayName.cancel}
              </button>
            </div>
          ) : (
            <div className={styles.editRow}>
              <span className={styles.fieldValue}>{user.displayName || COPY.table.noDisplayName}</span>
              <button type="button" className={styles.linkButton} onClick={startEditingDisplayName}>
                {COPY.editDisplayName.trigger}
              </button>
            </div>
          )}
        </div>
        {displayNameError ? (
          <p className={styles.fieldError} role="alert">
            {displayNameError}
          </p>
        ) : null}

        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>{COPY.detail.fields.lastLoginAt}</span>
          <span className={styles.fieldValue}>{formatDateTime(user.lastLoginAt)}</span>
        </div>

        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>{COPY.detail.fields.createdAt}</span>
          <span className={styles.fieldValue}>{formatDateTime(user.createdAt)}</span>
        </div>
      </Card>

      {/* Role & permissions */}
      <Card title={COPY.detail.sections.role}>
        <p className={styles.sectionDescription}>{COPY.detail.role.description}</p>

        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>{COPY.detail.fields.role}</span>
          <span className={styles.fieldValue}>{isOwnerRow ? he.roles.owner : he.roles.employee}</span>
        </div>

        <p className={styles.mutedNote}>{COPY.detail.role.readOnlyNote}</p>
      </Card>

      {/* Security */}
      <Card title={COPY.detail.sections.security}>
        <p className={styles.sectionDescription}>{COPY.detail.security.description}</p>

        <form className={styles.resetForm} onSubmit={handleResetPassword}>
          {resetError ? (
            <p className={styles.formError} role="alert">
              {resetError}
            </p>
          ) : null}
          {resetSuccess ? <p className={styles.formSuccess}>{COPY.detail.security.success}</p> : null}

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{COPY.detail.security.newPasswordLabel}</span>
            <input
              type="password"
              dir="ltr"
              className={styles.input}
              value={newPassword}
              placeholder={COPY.detail.security.newPasswordPlaceholder}
              onChange={(event) => {
                setNewPassword(event.target.value);
                setResetSuccess(false);
              }}
              disabled={resettingPassword}
              autoComplete="new-password"
            />
            {resetFieldError ? <span className={styles.fieldError}>{resetFieldError}</span> : null}
          </label>

          <div className={styles.formActions}>
            <PrimaryButton type="submit" disabled={resettingPassword || !newPassword}>
              {resettingPassword ? COPY.detail.security.submitting : COPY.detail.security.submit}
            </PrimaryButton>
          </div>
        </form>
      </Card>

      {/* Status */}
      <Card title={COPY.detail.sections.status}>
        <p className={styles.sectionDescription}>{COPY.detail.status.description}</p>

        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>{COPY.detail.fields.status}</span>
          <StatusBadge
            label={user.isActive ? COPY.status.active : COPY.status.inactive}
            tone={user.isActive ? "success" : "neutral"}
          />
        </div>

        {isOwnerRow ? (
          <p className={styles.mutedNote}>{COPY.activation.ownerHint}</p>
        ) : (
          <div className={styles.formActions}>
            <SecondaryButton type="button" onClick={openToggleDialog}>
              {user.isActive ? COPY.activation.deactivate : COPY.activation.activate}
            </SecondaryButton>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={dialogOpen}
        title={user.isActive ? COPY.activation.confirmDeactivateTitle : COPY.activation.confirmActivateTitle}
        body={user.isActive ? COPY.activation.confirmDeactivateBody : COPY.activation.confirmActivateBody}
        confirmLabel={user.isActive ? COPY.activation.deactivate : COPY.activation.activate}
        confirmingLabel={user.isActive ? COPY.activation.deactivating : COPY.activation.activating}
        cancelLabel={COPY.activation.confirmCancelLabel}
        onConfirm={confirmToggle}
        onCancel={closeToggleDialog}
        confirming={confirming}
        error={dialogError}
      />
    </div>
  );
}
