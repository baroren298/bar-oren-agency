"use client";

/*
 * UsersPageClient — Sprint 3: Users UI, revised by Sprint 3.1 (User Details
 * Page).
 *
 * All the interactive pieces of /admin/users: the "add employee" form and
 * the users table. Sprint 3.1's product decision — "editing a user should
 * open a full user management screen" — replaced this file's old inline
 * displayName edit and activate/deactivate toggle-with-confirm-dialog with
 * a single "ניהול" link per row to /admin/users/[id]
 * (app/admin/users/[id]/UserDetailClient.jsx), which now owns every write
 * to an existing user (displayName, activation, password reset). This file
 * still owns user *creation* (the add-employee form below) — that stays
 * here since it's a list-level action with no per-row id to navigate to
 * yet.
 *
 * Role changes and deletion are not offered anywhere in this file or the
 * detail page — matching this sprint's explicit scope. The status column
 * below is now read-only display; the "ניהול" link is how an Owner reaches
 * the activate/deactivate control that used to live inline here.
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
                  const isSelf = user.id === currentUserId;

                  return (
                    <tr key={user.id}>
                      <td dir="ltr" className={styles.emailCell}>
                        {user.email}
                        {isSelf ? <span className={styles.selfTag}> {COPY.table.you}</span> : null}
                      </td>
                      <td>{user.displayName || COPY.table.noDisplayName}</td>
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
                        <SecondaryButton href={`/admin/users/${user.id}`}>{COPY.detail.manage}</SecondaryButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
