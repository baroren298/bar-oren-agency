"use client";

/*
 * ClientsPageClient — Sprint 7B (Clients & Brands Foundation).
 *
 * Interactive pieces of /admin/clients: search, the archived-visibility
 * toggle, the add-client form, and the clients table. Follows
 * UsersPageClient.jsx's structure (create form via API + router.refresh(),
 * per-row navigation to a detail page that owns all further writes).
 *
 * Search is client-side (name + contact name substring, case-insensitive)
 * over whichever list is loaded. The archived toggle re-fetches
 * /api/admin/clients?includeArchived=1 once and swaps the displayed list —
 * default paint stays the server-provided ACTIVE-only list.
 *
 * No archive/edit controls here — those live on the detail page, where
 * archive is rendered for OWNER only (and re-enforced server-side; UI
 * visibility is never the security boundary).
 *
 * Props:
 *   - initialClients (array, required) — from clientService.listClients()
 *     (ACTIVE only), each row carrying `_count.brands` = active brand count.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/admin/Card";
import PrimaryButton from "@/components/admin/PrimaryButton";
import SecondaryButton from "@/components/admin/SecondaryButton";
import StatusBadge from "@/components/admin/StatusBadge";
import EmptyState from "@/components/admin/EmptyState";
import { he } from "@/lib/admin/i18n/he";
import { LIFECYCLE_STATUS } from "@/lib/admin/constants/enums";
import styles from "./clients.module.css";

const COPY = he.clients;
const EMPTY_CREATE_FORM = {
  name: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  notes: "",
};

function matchesSearch(client, query) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    (client.name || "").toLowerCase().includes(q) ||
    (client.contactName || "").toLowerCase().includes(q)
  );
}

export default function ClientsPageClient({ initialClients }) {
  const router = useRouter();

  const [showArchived, setShowArchived] = useState(false);
  const [archivedList, setArchivedList] = useState(null); // full list incl. archived, once fetched
  const [listError, setListError] = useState(null);
  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createFieldErrors, setCreateFieldErrors] = useState({});
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);

  async function handleToggleArchived(nextChecked) {
    setShowArchived(nextChecked);
    setListError(null);
    if (!nextChecked || archivedList !== null) return;
    try {
      const response = await fetch("/api/admin/clients?includeArchived=1");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setListError(body.error || COPY.errors.serverError);
        return;
      }
      setArchivedList(body.clients || []);
    } catch {
      setListError(COPY.errors.networkError);
    }
  }

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
      const response = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Sprint 7B.1 (UX polish): each validation error appears exactly
        // once. When the response carries fieldErrors, they render next to
        // their fields — the top-level banner is suppressed so the same
        // message never shows twice. The banner remains for errors with no
        // field to attach to (server/network).
        const fieldErrors = body.fieldErrors || {};
        setCreateFieldErrors(fieldErrors);
        setCreateError(
          Object.keys(fieldErrors).length > 0 ? null : body.error || COPY.errors.serverError
        );
        setCreating(false);
        return;
      }

      setCreating(false);
      closeCreateForm();
      // Invalidate the archived cache so a re-toggle refetches fresh data.
      setArchivedList(null);
      router.refresh();
    } catch {
      setCreateError(COPY.errors.networkError);
      setCreating(false);
    }
  }

  const baseList = showArchived && archivedList !== null ? archivedList : initialClients;
  const visibleClients = baseList.filter((client) => matchesSearch(client, search));

  return (
    <div className={styles.tokens}>
      <div className={styles.actionsRow}>
        <div className={styles.toolbar}>
          <input
            type="search"
            className={styles.searchInput}
            value={search}
            placeholder={COPY.searchPlaceholder}
            onChange={(event) => setSearch(event.target.value)}
          />
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => handleToggleArchived(event.target.checked)}
            />
            {COPY.showArchived}
          </label>
        </div>
        {!createOpen ? (
          <PrimaryButton type="button" onClick={() => setCreateOpen(true)}>
            {COPY.addClient.trigger}
          </PrimaryButton>
        ) : null}
      </div>

      {listError ? (
        <p className={styles.formError} role="alert">
          {listError}
        </p>
      ) : null}

      {createOpen ? (
        <Card title={COPY.addClient.formTitle}>
          <form className={styles.createForm} onSubmit={handleCreateSubmit}>
            {createError ? (
              <p className={styles.formError} role="alert">
                {createError}
              </p>
            ) : null}

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{COPY.addClient.fields.name}</span>
                <input
                  type="text"
                  className={styles.input}
                  value={createForm.name}
                  placeholder={COPY.addClient.fields.namePlaceholder}
                  onChange={(event) => updateCreateField("name", event.target.value)}
                />
                {createFieldErrors.name ? (
                  <span className={styles.fieldError}>{createFieldErrors.name}</span>
                ) : null}
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>{COPY.addClient.fields.contactName}</span>
                <input
                  type="text"
                  className={styles.input}
                  value={createForm.contactName}
                  onChange={(event) => updateCreateField("contactName", event.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>{COPY.addClient.fields.contactEmail}</span>
                <input
                  type="email"
                  dir="ltr"
                  className={styles.input}
                  value={createForm.contactEmail}
                  onChange={(event) => updateCreateField("contactEmail", event.target.value)}
                />
                {createFieldErrors.contactEmail ? (
                  <span className={styles.fieldError}>{createFieldErrors.contactEmail}</span>
                ) : null}
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>{COPY.addClient.fields.contactPhone}</span>
                <input
                  type="tel"
                  dir="ltr"
                  className={styles.input}
                  value={createForm.contactPhone}
                  onChange={(event) => updateCreateField("contactPhone", event.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>{COPY.addClient.fields.notes}</span>
                <textarea
                  className={styles.textarea}
                  value={createForm.notes}
                  onChange={(event) => updateCreateField("notes", event.target.value)}
                />
              </label>
            </div>

            <div className={styles.formActions}>
              <SecondaryButton type="button" onClick={closeCreateForm} disabled={creating}>
                {COPY.addClient.cancel}
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={creating}>
                {creating ? COPY.addClient.submitting : COPY.addClient.submit}
              </PrimaryButton>
            </div>
          </form>
        </Card>
      ) : null}

      {baseList.length === 0 ? (
        <EmptyState
          title={COPY.emptyTitle}
          description={COPY.emptyDescription}
          action={
            !createOpen ? (
              <PrimaryButton type="button" onClick={() => setCreateOpen(true)}>
                {COPY.emptyCta}
              </PrimaryButton>
            ) : null
          }
        />
      ) : visibleClients.length === 0 ? (
        <EmptyState title={COPY.noSearchResults} />
      ) : (
        <Card>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{COPY.table.name}</th>
                  <th>{COPY.table.contactName}</th>
                  <th>{COPY.table.activeBrands}</th>
                  <th>{COPY.table.status}</th>
                  <th>{COPY.table.actions}</th>
                </tr>
              </thead>
              <tbody>
                {visibleClients.map((client) => (
                  <tr key={client.id}>
                    <td className={styles.nameCell}>{client.name}</td>
                    <td>{client.contactName || COPY.table.noContactName}</td>
                    <td>{client._count?.brands ?? 0}</td>
                    <td>
                      <StatusBadge
                        label={
                          client.status === LIFECYCLE_STATUS.ARCHIVED
                            ? COPY.status.archived
                            : COPY.status.active
                        }
                        tone={client.status === LIFECYCLE_STATUS.ARCHIVED ? "neutral" : "success"}
                      />
                    </td>
                    <td>
                      <SecondaryButton href={`/admin/clients/${client.id}`}>
                        {COPY.table.view}
                      </SecondaryButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
