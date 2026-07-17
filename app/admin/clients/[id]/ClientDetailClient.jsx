"use client";

/*
 * ClientDetailClient — Sprint 7B (Clients & Brands Foundation).
 *
 * All interactive pieces of /admin/clients/[id]:
 *   - client details display + one "edit details" mode (name/contact
 *     fields/notes together, Save/Cancel — same single-edit-mode feel as
 *     UserDetailClient's profile editing)
 *   - OWNER-only client archive (ConfirmDialog; wording states the name
 *     stays reserved and there is no unarchive)
 *   - Brands section inline: list, add form, per-row rename/notes edit,
 *     OWNER-only per-row archive. No separate brand page.
 *
 * An ARCHIVED client renders read-only: no edit mode, no add-brand form,
 * no brand actions (matching clientService, which rejects those writes
 * with Hebrew 409s regardless of what the UI shows). Archive buttons are
 * hidden for EMPLOYEE — visibility only; the OWNER-only routes + service
 * re-assertion are the real boundary.
 *
 * Props:
 *   - initialClient (object, required) — clientService.getClientDetail()
 *     result: client fields + `brands` array (all statuses, name-asc).
 *   - role (string, required) — session role, for OWNER-only controls.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/admin/Card";
import PrimaryButton from "@/components/admin/PrimaryButton";
import SecondaryButton from "@/components/admin/SecondaryButton";
import StatusBadge from "@/components/admin/StatusBadge";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EmptyState from "@/components/admin/EmptyState";
import { he } from "@/lib/admin/i18n/he";
import { ROLE, LIFECYCLE_STATUS } from "@/lib/admin/constants/enums";
import styles from "../clients.module.css";

const COPY = he.clients;

function statusBadgeProps(status) {
  const archived = status === LIFECYCLE_STATUS.ARCHIVED;
  return {
    label: archived ? COPY.status.archived : COPY.status.active,
    tone: archived ? "neutral" : "success",
  };
}

export default function ClientDetailClient({ initialClient, role }) {
  const router = useRouter();
  const isOwner = role === ROLE.OWNER;
  const clientArchived = initialClient.status === LIFECYCLE_STATUS.ARCHIVED;

  // ── Client details edit mode ────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const [editError, setEditError] = useState(null);
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setEditForm({
      name: initialClient.name || "",
      contactName: initialClient.contactName || "",
      contactEmail: initialClient.contactEmail || "",
      contactPhone: initialClient.contactPhone || "",
      notes: initialClient.notes || "",
    });
    setEditFieldErrors({});
    setEditError(null);
    setEditing(true);
  }

  function updateEditField(field, value) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
    setEditFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleEditSave(event) {
    event.preventDefault();
    setEditError(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/clients/${initialClient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Sprint 7B.1 (UX polish): fieldErrors render next to their fields;
        // the banner shows only when there is no field to attach to — each
        // validation message appears exactly once.
        const fieldErrors = body.fieldErrors || {};
        setEditFieldErrors(fieldErrors);
        setEditError(
          Object.keys(fieldErrors).length > 0 ? null : body.error || COPY.errors.serverError
        );
        setSaving(false);
        return;
      }
      setSaving(false);
      setEditing(false);
      router.refresh();
    } catch {
      setEditError(COPY.errors.networkError);
      setSaving(false);
    }
  }

  // ── Client archive (OWNER only) ─────────────────────────────────────────
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState(null);

  async function handleArchiveClient() {
    setArchiveError(null);
    setArchiving(true);
    try {
      const response = await fetch(`/api/admin/clients/${initialClient.id}/archive`, {
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setArchiveError(body.error || COPY.errors.serverError);
        setArchiving(false);
        return;
      }
      setArchiving(false);
      setArchiveDialogOpen(false);
      router.refresh();
    } catch {
      setArchiveError(COPY.errors.networkError);
      setArchiving(false);
    }
  }

  // ── Add brand ───────────────────────────────────────────────────────────
  const [addBrandOpen, setAddBrandOpen] = useState(false);
  const [brandForm, setBrandForm] = useState({ name: "", notes: "" });
  const [brandFieldErrors, setBrandFieldErrors] = useState({});
  const [brandError, setBrandError] = useState(null);
  const [creatingBrand, setCreatingBrand] = useState(false);

  function closeAddBrand() {
    setAddBrandOpen(false);
    setBrandForm({ name: "", notes: "" });
    setBrandFieldErrors({});
    setBrandError(null);
  }

  async function handleAddBrandSubmit(event) {
    event.preventDefault();
    setBrandError(null);
    setCreatingBrand(true);
    try {
      const response = await fetch(`/api/admin/clients/${initialClient.id}/brands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brandForm),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Sprint 7B.1 — same single-appearance rule as the client form.
        const fieldErrors = body.fieldErrors || {};
        setBrandFieldErrors(fieldErrors);
        setBrandError(
          Object.keys(fieldErrors).length > 0 ? null : body.error || COPY.errors.serverError
        );
        setCreatingBrand(false);
        return;
      }
      setCreatingBrand(false);
      closeAddBrand();
      router.refresh();
    } catch {
      setBrandError(COPY.errors.networkError);
      setCreatingBrand(false);
    }
  }

  // ── Per-brand edit / archive ────────────────────────────────────────────
  const [editingBrandId, setEditingBrandId] = useState(null);
  const [brandEditForm, setBrandEditForm] = useState({ name: "", notes: "" });
  const [brandEditFieldErrors, setBrandEditFieldErrors] = useState({});
  const [brandEditError, setBrandEditError] = useState(null);
  const [savingBrand, setSavingBrand] = useState(false);

  const [archiveBrandTarget, setArchiveBrandTarget] = useState(null);
  const [archivingBrand, setArchivingBrand] = useState(false);
  const [archiveBrandError, setArchiveBrandError] = useState(null);

  function startBrandEdit(brand) {
    setEditingBrandId(brand.id);
    setBrandEditForm({ name: brand.name || "", notes: brand.notes || "" });
    setBrandEditFieldErrors({});
    setBrandEditError(null);
  }

  function cancelBrandEdit() {
    setEditingBrandId(null);
    setBrandEditFieldErrors({});
    setBrandEditError(null);
  }

  async function handleBrandEditSave(brandId) {
    setBrandEditError(null);
    setSavingBrand(true);
    try {
      const response = await fetch(`/api/admin/brands/${brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brandEditForm),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Sprint 7B.1 — single appearance: inline field error OR the row's
        // general error, never both for the same failure.
        const fieldErrors = body.fieldErrors || {};
        setBrandEditFieldErrors(fieldErrors);
        setBrandEditError(
          Object.keys(fieldErrors).length > 0 ? null : body.error || COPY.errors.serverError
        );
        setSavingBrand(false);
        return;
      }
      setSavingBrand(false);
      cancelBrandEdit();
      router.refresh();
    } catch {
      setBrandEditError(COPY.errors.networkError);
      setSavingBrand(false);
    }
  }

  async function handleArchiveBrand() {
    if (!archiveBrandTarget) return;
    setArchiveBrandError(null);
    setArchivingBrand(true);
    try {
      const response = await fetch(`/api/admin/brands/${archiveBrandTarget.id}/archive`, {
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setArchiveBrandError(body.error || COPY.errors.serverError);
        setArchivingBrand(false);
        return;
      }
      setArchivingBrand(false);
      setArchiveBrandTarget(null);
      router.refresh();
    } catch {
      setArchiveBrandError(COPY.errors.networkError);
      setArchivingBrand(false);
    }
  }

  const brands = initialClient.brands || [];

  return (
    <div className={styles.detailStack}>
      <div className={styles.detailHeaderRow}>
        <a href="/admin/clients" className={styles.backLink}>
          {COPY.detail.backToList}
        </a>
        {isOwner && !clientArchived ? (
          <SecondaryButton type="button" onClick={() => setArchiveDialogOpen(true)}>
            {COPY.detail.archive.trigger}
          </SecondaryButton>
        ) : null}
      </div>

      <div className={styles.titleRow}>
        <h1>{initialClient.name}</h1>
        <StatusBadge {...statusBadgeProps(initialClient.status)} />
      </div>

      {/* ── Client details ─────────────────────────────────────────────── */}
      {/* Sprint 7B.1: the edit action lives in the card header (Card's
          additive `action` prop) instead of a bottom actions row. */}
      <Card
        title={COPY.detail.title}
        action={
          !editing && !clientArchived ? (
            <SecondaryButton type="button" onClick={startEditing}>
              {COPY.detail.edit}
            </SecondaryButton>
          ) : null
        }
      >
        {!editing ? (
          <>
            <div className={styles.detailRows}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>{COPY.addClient.fields.name}</span>
                <span className={styles.detailValue}>{initialClient.name}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>{COPY.addClient.fields.contactName}</span>
                <span className={styles.detailValue}>
                  {initialClient.contactName || COPY.table.noContactName}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>{COPY.addClient.fields.contactEmail}</span>
                <span className={styles.detailValue} dir="ltr">
                  {initialClient.contactEmail || COPY.table.noContactName}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>{COPY.addClient.fields.contactPhone}</span>
                <span className={styles.detailValue} dir="ltr">
                  {initialClient.contactPhone || COPY.table.noContactName}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>{COPY.addClient.fields.notes}</span>
                <span className={styles.detailValue}>
                  {initialClient.notes || COPY.table.noContactName}
                </span>
              </div>
              {/* Sprint 7B.1 — lightweight summary from data already on the
                  page (no new DB fields): count of ACTIVE brands. */}
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>{COPY.table.activeBrands}</span>
                <span className={styles.detailValue}>
                  {brands.filter((brand) => brand.status === LIFECYCLE_STATUS.ACTIVE).length}
                </span>
              </div>
            </div>
          </>
        ) : (
          <form className={styles.createForm} onSubmit={handleEditSave}>
            {editError ? (
              <p className={styles.formError} role="alert">
                {editError}
              </p>
            ) : null}

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{COPY.addClient.fields.name}</span>
                <input
                  type="text"
                  className={styles.input}
                  value={editForm.name}
                  onChange={(event) => updateEditField("name", event.target.value)}
                />
                {editFieldErrors.name ? (
                  <span className={styles.fieldError}>{editFieldErrors.name}</span>
                ) : null}
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>{COPY.addClient.fields.contactName}</span>
                <input
                  type="text"
                  className={styles.input}
                  value={editForm.contactName}
                  onChange={(event) => updateEditField("contactName", event.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>{COPY.addClient.fields.contactEmail}</span>
                <input
                  type="email"
                  dir="ltr"
                  className={styles.input}
                  value={editForm.contactEmail}
                  onChange={(event) => updateEditField("contactEmail", event.target.value)}
                />
                {editFieldErrors.contactEmail ? (
                  <span className={styles.fieldError}>{editFieldErrors.contactEmail}</span>
                ) : null}
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>{COPY.addClient.fields.contactPhone}</span>
                <input
                  type="tel"
                  dir="ltr"
                  className={styles.input}
                  value={editForm.contactPhone}
                  onChange={(event) => updateEditField("contactPhone", event.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>{COPY.addClient.fields.notes}</span>
                <textarea
                  className={styles.textarea}
                  value={editForm.notes}
                  onChange={(event) => updateEditField("notes", event.target.value)}
                />
              </label>
            </div>

            <div className={styles.formActions}>
              <SecondaryButton type="button" onClick={() => setEditing(false)} disabled={saving}>
                {COPY.detail.cancel}
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={saving}>
                {saving ? COPY.detail.saving : COPY.detail.save}
              </PrimaryButton>
            </div>
          </form>
        )}
      </Card>

      {/* ── Brands ─────────────────────────────────────────────────────── */}
      <Card title={COPY.brands.sectionTitle}>
        {!clientArchived ? (
          <div className={styles.sectionActions}>
            {!addBrandOpen ? (
              <PrimaryButton type="button" onClick={() => setAddBrandOpen(true)}>
                {COPY.brands.addBrand.trigger}
              </PrimaryButton>
            ) : null}
          </div>
        ) : null}

        {addBrandOpen ? (
          <form className={styles.createForm} onSubmit={handleAddBrandSubmit}>
            {brandError ? (
              <p className={styles.formError} role="alert">
                {brandError}
              </p>
            ) : null}

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{COPY.brands.addBrand.fields.name}</span>
                <input
                  type="text"
                  className={styles.input}
                  value={brandForm.name}
                  placeholder={COPY.brands.addBrand.fields.namePlaceholder}
                  onChange={(event) => {
                    setBrandForm((prev) => ({ ...prev, name: event.target.value }));
                    setBrandFieldErrors((prev) => {
                      if (!prev.name) return prev;
                      const next = { ...prev };
                      delete next.name;
                      return next;
                    });
                  }}
                />
                {brandFieldErrors.name ? (
                  <span className={styles.fieldError}>{brandFieldErrors.name}</span>
                ) : null}
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>{COPY.brands.addBrand.fields.notes}</span>
                <textarea
                  className={styles.textarea}
                  value={brandForm.notes}
                  onChange={(event) =>
                    setBrandForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className={styles.formActions}>
              <SecondaryButton type="button" onClick={closeAddBrand} disabled={creatingBrand}>
                {COPY.brands.addBrand.cancel}
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={creatingBrand}>
                {creatingBrand ? COPY.brands.addBrand.submitting : COPY.brands.addBrand.submit}
              </PrimaryButton>
            </div>
          </form>
        ) : null}

        {brands.length === 0 ? (
          <EmptyState
            title={COPY.brands.emptyTitle}
            description={COPY.brands.emptyDescription}
          />
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{COPY.brands.table.name}</th>
                  <th>{COPY.brands.table.status}</th>
                  <th>{COPY.brands.table.actions}</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((brand) => {
                  const brandArchived = brand.status === LIFECYCLE_STATUS.ARCHIVED;
                  const isEditingThis = editingBrandId === brand.id;

                  return (
                    <tr key={brand.id}>
                      <td className={styles.nameCell}>
                        {isEditingThis ? (
                          <div className={styles.rowActions}>
                            <input
                              type="text"
                              className={styles.inlineInput}
                              value={brandEditForm.name}
                              onChange={(event) =>
                                setBrandEditForm((prev) => ({
                                  ...prev,
                                  name: event.target.value,
                                }))
                              }
                            />
                            {brandEditFieldErrors.name ? (
                              <span className={styles.fieldError}>
                                {brandEditFieldErrors.name}
                              </span>
                            ) : null}
                            {brandEditError ? (
                              <span className={styles.fieldError}>{brandEditError}</span>
                            ) : null}
                          </div>
                        ) : (
                          brand.name
                        )}
                      </td>
                      <td>
                        <StatusBadge {...statusBadgeProps(brand.status)} />
                      </td>
                      <td>
                        {brandArchived || clientArchived ? (
                          <span className={styles.mutedNote}>—</span>
                        ) : isEditingThis ? (
                          <div className={styles.rowActions}>
                            <button
                              type="button"
                              className={styles.linkButton}
                              onClick={() => handleBrandEditSave(brand.id)}
                              disabled={savingBrand}
                            >
                              {savingBrand ? COPY.brands.saving : COPY.brands.save}
                            </button>
                            <button
                              type="button"
                              className={styles.linkButton}
                              onClick={cancelBrandEdit}
                              disabled={savingBrand}
                            >
                              {COPY.brands.cancel}
                            </button>
                          </div>
                        ) : (
                          <div className={styles.rowActions}>
                            <button
                              type="button"
                              className={styles.linkButton}
                              onClick={() => startBrandEdit(brand)}
                            >
                              {COPY.brands.edit}
                            </button>
                            {isOwner ? (
                              <button
                                type="button"
                                className={styles.linkButton}
                                onClick={() => setArchiveBrandTarget(brand)}
                              >
                                {COPY.brands.archive.trigger}
                              </button>
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={archiveDialogOpen}
        title={COPY.detail.archive.confirmTitle}
        body={COPY.detail.archive.confirmBody}
        confirmLabel={COPY.detail.archive.trigger}
        confirmingLabel={COPY.detail.archive.archiving}
        cancelLabel={COPY.detail.archive.confirmCancelLabel}
        confirming={archiving}
        error={archiveError}
        onConfirm={handleArchiveClient}
        onCancel={() => {
          if (!archiving) {
            setArchiveDialogOpen(false);
            setArchiveError(null);
          }
        }}
      />

      <ConfirmDialog
        open={archiveBrandTarget !== null}
        title={COPY.brands.archive.confirmTitle}
        body={COPY.brands.archive.confirmBody}
        confirmLabel={COPY.brands.archive.trigger}
        confirmingLabel={COPY.brands.archive.archiving}
        cancelLabel={COPY.brands.archive.confirmCancelLabel}
        confirming={archivingBrand}
        error={archiveBrandError}
        onConfirm={handleArchiveBrand}
        onCancel={() => {
          if (!archivingBrand) {
            setArchiveBrandTarget(null);
            setArchiveBrandError(null);
          }
        }}
      />
    </div>
  );
}
