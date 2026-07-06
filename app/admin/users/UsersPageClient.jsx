"use client";

/*
 * UsersPageClient — Sprint 3: Users UI.
 *
 * All the interactive pieces of /admin/users: the "add employee" form,
 * inline displayName editing, and the activate/deactivate toggle (with a
 * confirmation dialog, mirroring TalentVisibilityAction.jsx's shape). Every
 * write goes through the new /api/admin/users REST routes via fetch, then
 * router.refresh() re-reads the server-side list from page.jsx — same
 * pattern as StartEditingButton/CancelEditingButton/TalentVisibilityAction,
 * no client-side DB/service access of any kind.
 *
 * Role changes and deletion are not offered anywhere in this file — there
 * is no role selector and no delete action, matching this sprint's explicit
 * scope. Deactivating an OWNER row is not offered either: since this sprint
 * has no way to provision a second Owner, the acting Owner's own row is
 * always the only OWNER row here, and hiding its toggle entirely (rather
 * than showing it disabled) is the simplest way to make "you can't disable
 * yourself / the only Owner" true by construction in the UI, on top of (not
 * instead of) userService.setActive's own server-side enforcement of both
 * rules.
 *
 * Props:
 *   - initialUsers (array, required) — from userService.listUsers(), see
 *     page.jsx
 *   - currentUserId (string, required) — the acting Owner's own id, used
 *     only to show a small "(you)" tag on their own row
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/admin/Card";
import PrimaryButton from "@/components/admin/PrimaryButton";
import SecondaryButton from "@/components/admin/SecondaryButton";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import StatusBadge from "@/components/admin/StatusBadge";
import EmptyState from "@/components/admin/EmptyState";
import { he } from "@/lib/admin/i18n/he";
import { ROLE } from "@/lib/admin/constants/enums";
import styles from "./users.module.css";

const COPY = he.users;
const EMPTY_CREATE_FORM = { email: "", displayName: "", temporaryPassword: "" };

function formatDateTime(value) {
  if (!value) return COPY.table.never;
  try {
    return new Date(value).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return COPY.table.never;
  }
}

export default function UsersPageClient({ initialUsers, currentUserId }) {
  const router = useRouter();

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createFieldErrors, setCreateFieldErrors] = useState({});
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);

  const [editingUserId, setEditingUserId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [dialogUser, setDialogUser] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [dialogError, setDialogError] = useState(null);

  function updateCreateField(field, value) {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
    setCreateFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function closeCreateForm() {
    setCreateOpen(false);
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateFieldErrors({});
    setCreateError(null);
  }

  async function handleCreateSubmit(event) {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setCreateFieldErrors(body.fieldErrors || {});
        setCreateError(body.error || COPY.errors.serverError);
        setCreating(false);
        return;
      }

      setCreating(false);
      closeCreateForm();
      router.refresh();
    } catch {
      setCreateError(COPY.errors.networkError);
      setCreating(false);
    }
  }

  function startEditing(user) {
    setEditingUserId(user.id);
    setEditValue(user.displayName || "");
    setEditError(null);
  }

  function cancelEditing() {
    setEditingUserId(null);
    setEditValue("");
    setEditError(null);
  }

  async function saveDisplayName(userId) {
    setSavingEdit(true);
    setEditError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: editValue }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setEditError(body.error || COPY.errors.serverError);
        setSavingEdit(false);
        return;
      }

      setSavingEdit(false);
      setEditingUserId(null);
      setEditValue("");
      router.refresh();
    } catch {
      setEditError(COPY.errors.networkError);
      setSavingEdit(false);
    }
  }

  function openToggleDialog(user) {
    setDialogUser(user);
    setDialogError(null);
  }

  function closeToggleDialog() {
    if (confirming) return;
    setDialogUser(null);
    setDialogError(null);
  }

  async function confirmToggle() {
    if (!dialogUser) return;
    setConfirming(true);
    setDialogError(null);

    const nextActive = !dialogUser.isActive;

    try {
      const response = await fetch(`/api/admin/users/${dialogUser.id}`, {
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
      setDialogUser(null);
      router.refresh();
    } catch {
      setDialogError(COPY.errors.networkError);
      setConfirming(false);
    }
  }

  const isDeactivating = dialogUser ? dialogUser.isActive : false;

  return (
    <div className={styles.tokens}>
      <div className={styles.actionsRow}>
        {!createOpen ? (
          <PrimaryButton type="button" onClick={() => setCreateOpen(true)}>
            {COPY.addEmployee.trigger}
          </PrimaryButton>
        ) : null}
      </div>

      {createOpen ? (
        <Card title={COPY.addEmployee.formTitle}>
          <form className={styles.createForm} onSubmit={handleCreateSubmit}>
            {createError ? (
              <p className={styles.formError} role="alert">
                {createError}
              </p>
            ) : null}

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{COPY.addEmployee.fields.email}</span>
                <input
                  type="email"
                  dir="ltr"
                  className={styles.input}
                  value={createForm.email}
                  placeholder={COPY.addEmployee.fields.emailPlaceholder}
                  onChange={(event) => updateCreateField("email", event.target.value)}
                />
                {createFieldErrors.email ? (
                  <span className={styles.fieldError}>{createFieldErrors.email}</span>
                ) : null}
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>{COPY.addEmployee.fields.displayName}</span>
                <input
                  type="text"
                  className={styles.input}
                  value={createForm.displayName}
                  placeholder={COPY.addEmployee.fields.displayNamePlaceholder}
                  onChange={(event) => updateCreateField("displayName", event.target.value)}
                />
                {createFieldErrors.displayName ? (
                  <span className={styles.fieldError}>{createFieldErrors.displayName}</span>
                ) : null}
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>{COPY.addEmployee.fields.temporaryPassword}</span>
                <input
                  type="text"
                  dir="ltr"
                  className={styles.input}
                  value={createForm.temporaryPassword}
                  placeholder={COPY.addEmployee.fields.temporaryPasswordPlaceholder}
                  onChange={(event) => updateCreateField("temporaryPassword", event.target.value)}
                />
                <span className={styles.fieldHelper}>{COPY.addEmployee.fields.temporaryPasswordHelper}</span>
                {createFieldErrors.temporaryPassword ? (
                  <span className={styles.fieldError}>{createFieldErrors.temporaryPassword}</span>
                ) : null}
              </label>
            </div>

            <div className={styles.formActions}>
              <SecondaryButton type="button" onClick={closeCreateForm} disabled={creating}>
                {COPY.addEmployee.cancel}
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={creating}>
                {creating ? COPY.addEmployee.submitting : COPY.addEmployee.submit}
              </PrimaryButton>
            </div>
          </form>
        </Card>
      ) : null}

      {initialUsers.length === 0 ? (
        <EmptyState title={COPY.emptyTitle} description={COPY.emptyDescription} />
      ) : (
        <Card>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{COPY.table.email}</th>
                  <th>{COPY.table.displayName}</th>
                  <th>{COPY.table.role}</th>
                  <th>{COPY.table.status}</th>
                  <th>{COPY.table.lastLogin}</th>
                  <th>{COPY.table.createdAt}</th>
                  <th>{COPY.table.actions}</th>
                </tr>
              </thead>
              <tbody>
                {initialUsers.map((user) => {
                  const isEditing = editingUserId === user.id;
                  const isSelf = user.id === currentUserId;
                  const isOwnerRow = user.role === ROLE.OWNER;

                  return (
                    <tr key={user.id}>
                      <td dir="ltr" className={styles.emailCell}>
                        {user.email}
                        {isSelf ? <span className={styles.selfTag}> {COPY.table.you}</span> : null}
                      </td>
                      <td>
                        {isEditing ? (
                          <div className={styles.editRow}>
                            <input
                              type="text"
                              className={styles.inlineInput}
                              value={editValue}
                              onChange={(event) => setEditValue(event.target.value)}
                              disabled={savingEdit}
                            />
                            <button
                              type="button"
                              className={styles.linkButton}
                              onClick={() => saveDisplayName(user.id)}
                              disabled={savingEdit}
                            >
                              {savingEdit ? COPY.editDisplayName.saving : COPY.editDisplayName.save}
                            </button>
                            <button
                              type="button"
                              className={styles.linkButton}
                              onClick={cancelEditing}
                              disabled={savingEdit}
                            >
                              {COPY.editDisplayName.cancel}
                            </button>
                            {editError ? <div className={styles.fieldError}>{editError}</div> : null}
                          </div>
                        ) : (
                          <div className={styles.displayNameRow}>
                            <span>{user.displayName || COPY.table.noDisplayName}</span>
                            <button type="button" className={styles.linkButton} onClick={() => startEditing(user)}>
                              {COPY.editDisplayName.trigger}
                            </button>
                          </div>
                        )}
                      </td>
                      <td>{user.role === ROLE.OWNER ? he.roles.owner : he.roles.employee}</td>
                      <td>
                        <StatusBadge
                          label={user.isActive ? COPY.status.active : COPY.status.inactive}
                          tone={user.isActive ? "success" : "neutral"}
                        />
                      </td>
                      <td>{formatDateTime(user.lastLoginAt)}</td>
                      <td>{formatDateTime(user.createdAt)}</td>
                      <td>
                        {isOwnerRow ? (
                          <span className={styles.mutedNote}>{COPY.activation.ownerHint}</span>
                        ) : (
                          <SecondaryButton type="button" onClick={() => openToggleDialog(user)}>
                            {user.isActive ? COPY.activation.deactivate : COPY.activation.activate}
                          </SecondaryButton>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(dialogUser)}
        title={isDeactivating ? COPY.activation.confirmDeactivateTitle : COPY.activation.confirmActivateTitle}
        body={isDeactivating ? COPY.activation.confirmDeactivateBody : COPY.activation.confirmActivateBody}
        confirmLabel={isDeactivating ? COPY.activation.deactivate : COPY.activation.activate}
        confirmingLabel={isDeactivating ? COPY.activation.deactivating : COPY.activation.activating}
        cancelLabel={COPY.activation.confirmCancelLabel}
        onConfirm={confirmToggle}
        onCancel={closeToggleDialog}
        confirming={confirming}
        error={dialogError}
      />
    </div>
  );
}
