"use client";

/*
 * UserDetailClient — Sprint 3.1: User Details Page, revised by Sprint 3.2
 * (User Detail UX Cleanup).
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
 *   - Profile displayName + email edit -> PATCH /api/admin/users/[id]
 *   - Status activate/deactivate       -> PATCH /api/admin/users/[id]
 *   - Security password reset          -> POST /api/admin/users/[id]/password
 *
 * Sprint 3.2 QA fix (#3/#4): the Profile section used to have its own
 * separate inline "ערוך" trigger just for displayName, with email shown as
 * permanently read-only. That's replaced with a single top-level "ערוך
 * פרופיל" (Edit profile) mode — one Edit button flips both displayName and
 * email into editable inputs together, with one Save/Cancel pair — the same
 * "click Edit, the whole section's fields become editable, Save/Cancel the
 * whole thing" feel as the Talent editor (see StartEditingButton.jsx /
 * CancelEditingButton.jsx), rather than a per-field inline edit link. Save
 * sends one PATCH with both fields; the route (app/api/admin/users/[id]/
 * route.js) applies them as two independent userService calls server-side
 * (displayName, then email — see that route's header comment for why that
 * order), but from this component's point of view it's one request, one
 * pending state, one error surface.
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
 *   - isSelfView (boolean, required) — Sprint 3c: is the acting Owner
 *     viewing their own user record (session.userId === user.id,
 *     computed server-side in page.jsx)? Forwarded only to
 *     SessionsSection, which uses it to pick the revoke-all copy variant
 *     ("נתק את כל שאר ההתחברויות" vs "נתק את כל ההתחברויות") — it plays
 *     no role in authorization; the API independently enforces which
 *     session, if any, is spared.
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
import SessionsSection from "@/components/admin/SessionsSection";
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

export default function UserDetailClient({ user, isSelfView }) {
  const router = useRouter();
  const isOwnerRow = user.role === ROLE.OWNER;

  // Profile section — single "edit profile" mode covering displayName +
  // email together (Sprint 3.2 QA fix #3/#4), replacing the old
  // displayName-only inline edit.
  const [editingProfile, setEditingProfile] = useState(false);
  const [displayNameValue, setDisplayNameValue] = useState(user.displayName || "");
  const [emailValue, setEmailValue] = useState(user.email || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileFieldErrors, setProfileFieldErrors] = useState({});

  function startEditingProfile() {
    setDisplayNameValue(user.displayName || "");
    setEmailValue(user.email || "");
    setProfileError(null);
    setProfileFieldErrors({});
    setEditingProfile(true);
  }

  function cancelEditingProfile() {
    setEditingProfile(false);
    setDisplayNameValue(user.displayName || "");
    setEmailValue(user.email || "");
    setProfileError(null);
    setProfileFieldErrors({});
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileFieldErrors({});

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayNameValue, email: emailValue }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setProfileFieldErrors(body.fieldErrors || {});
        setProfileError(body.error || COPY.errors.serverError);
        setSavingProfile(false);
        return;
      }

      setSavingProfile(false);
      setEditingProfile(false);
      router.refresh();
    } catch {
      setProfileError(COPY.errors.networkError);
      setSavingProfile(false);
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

        {!editingProfile ? (
          <>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{COPY.detail.fields.email}</span>
              <span className={styles.fieldValue} dir="ltr">
                {user.email}
              </span>
            </div>

            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{COPY.detail.fields.displayName}</span>
              <span className={styles.fieldValue}>{user.displayName || COPY.table.noDisplayName}</span>
            </div>

            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{COPY.detail.fields.lastLoginAt}</span>
              <span className={styles.fieldValue}>{formatDateTime(user.lastLoginAt)}</span>
            </div>

            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{COPY.detail.fields.createdAt}</span>
              <span className={styles.fieldValue}>{formatDateTime(user.createdAt)}</span>
            </div>

            <div className={`${styles.formActions} ${styles.profileViewActions}`}>
              <SecondaryButton type="button" onClick={startEditingProfile}>
                {COPY.editProfile.trigger}
              </SecondaryButton>
            </div>
          </>
        ) : (
          <form className={styles.resetForm} onSubmit={saveProfile}>
            {profileError ? (
              <p className={styles.formError} role="alert">
                {profileError}
              </p>
            ) : null}

            <label className={styles.field}>
              <span className={styles.fieldLabel}>{COPY.detail.fields.email}</span>
              <input
                type="email"
                dir="ltr"
                className={styles.input}
                value={emailValue}
                onChange={(event) => setEmailValue(event.target.value)}
                disabled={savingProfile}
                autoComplete="email"
              />
              {profileFieldErrors.email ? <span className={styles.fieldError}>{profileFieldErrors.email}</span> : null}
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>{COPY.detail.fields.displayName}</span>
              <input
                type="text"
                className={styles.input}
                value={displayNameValue}
                onChange={(event) => setDisplayNameValue(event.target.value)}
                disabled={savingProfile}
              />
              {profileFieldErrors.displayName ? (
                <span className={styles.fieldError}>{profileFieldErrors.displayName}</span>
              ) : null}
            </label>

            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{COPY.detail.fields.lastLoginAt}</span>
              <span className={styles.fieldValue}>{formatDateTime(user.lastLoginAt)}</span>
            </div>

            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{COPY.detail.fields.createdAt}</span>
              <span className={styles.fieldValue}>{formatDateTime(user.createdAt)}</span>
            </div>

            <div className={styles.formActions}>
              <SecondaryButton type="button" onClick={cancelEditingProfile} disabled={savingProfile}>
                {COPY.editProfile.cancel}
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={savingProfile}>
                {savingProfile ? COPY.editProfile.saving : COPY.editProfile.save}
              </PrimaryButton>
            </div>
          </form>
        )}
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

      {/* Sessions — Sprint 3c: Session Management UI. Its own Card, its
          own client sub-component (SessionsSection) with its own
          fetch/dialog state, entirely separate from the Status card above
          — revoking a session never changes user.isActive and vice versa. */}
      <SessionsSection userId={user.id} isSelfView={isSelfView} />

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
