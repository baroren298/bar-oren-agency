"use client";

/*
 * NewCampaignForm — Sprint 8A (Campaigns UI Prototype). PROTOTYPE ONLY.
 *
 * The campaign creation flow, shared by both entry points:
 *   1. the main Campaigns page (no preselection), and
 *   2. a represented talent's profile tab (that talent preselected).
 *
 * Product rules enforced here (from the sprint brief):
 *   - Field order starts Client → Brand → Campaign name, always.
 *   - Brand options depend on the selected Client (simulated with local
 *     component state — there is no backend in this sprint).
 *   - Client and Brand are required regardless of entry point.
 *   - When opened from a talent profile the talent is preselected but MORE
 *     talents can still be added — one shared campaign, never a duplicate
 *     campaign per talent.
 *   - Per-talent deliverables + operational status, no financial fields.
 *
 * Inline <Card> form (not a modal) — matches ClientsPageClient's existing
 * create-form pattern, which is the admin's established UX for creation.
 * Submitting writes to the in-memory prototype store only.
 *
 * Props:
 *   - preselectedTalentIds (string[], optional)
 *   - onCreated (fn(campaign), required)
 *   - onCancel (fn, required)
 */

import { useState } from "react";
import Card from "@/components/admin/Card";
import PrimaryButton from "@/components/admin/PrimaryButton";
import SecondaryButton from "@/components/admin/SecondaryButton";
import {
  addCampaign,
  getClientById,
  DEMO_CLIENTS,
  DEMO_TALENTS,
  BUSINESS_STATUS,
  OPERATIONAL_STATUS,
  APPROVAL_STATUS,
  DELIVERABLE_TYPE,
} from "./_prototype/campaignPrototypeData";
import { campaignsCopy as COPY } from "./_prototype/copy";
import styles from "./campaigns.module.css";

let deliverableRowId = 1;

function emptyDeliverable() {
  return {
    id: `form-del-${deliverableRowId++}`,
    type: DELIVERABLE_TYPE.INSTAGRAM_REEL,
    quantity: 1,
    description: "",
    status: OPERATIONAL_STATUS.WAITING_CONTENT,
    notes: "",
  };
}

function emptyParticipant() {
  return {
    operationalStatus: OPERATIONAL_STATUS.WAITING_CONTENT,
    notes: "",
    deliverables: [emptyDeliverable()],
  };
}

export default function NewCampaignForm({ preselectedTalentIds = [], onCreated, onCancel }) {
  const [clientId, setClientId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [name, setName] = useState("");
  const [month, setMonth] = useState("");
  const [relevantDate, setRelevantDate] = useState("");
  const [businessStatus, setBusinessStatus] = useState(BUSINESS_STATUS.LEAD);

  // participantsByTalent: { [talentId]: { operationalStatus, notes, deliverables[] } }
  const [participantsByTalent, setParticipantsByTalent] = useState(() => {
    const initial = {};
    for (const talentId of preselectedTalentIds) {
      initial[talentId] = emptyParticipant();
    }
    return initial;
  });

  const [fieldErrors, setFieldErrors] = useState({});

  const selectedClient = clientId ? getClientById(clientId) : null;
  const brandOptions = selectedClient?.brands || [];
  const selectedTalentIds = Object.keys(participantsByTalent);

  function clearFieldError(field) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleClientChange(value) {
    setClientId(value);
    // Brand belongs to exactly one client — a stale selection can't survive.
    setBrandId("");
    clearFieldError("client");
  }

  function toggleTalent(talentId) {
    setParticipantsByTalent((prev) => {
      const next = { ...prev };
      if (next[talentId]) {
        delete next[talentId];
      } else {
        next[talentId] = emptyParticipant();
      }
      return next;
    });
    clearFieldError("talents");
  }

  function updateParticipant(talentId, patch) {
    setParticipantsByTalent((prev) => ({
      ...prev,
      [talentId]: { ...prev[talentId], ...patch },
    }));
  }

  function addDeliverable(talentId) {
    setParticipantsByTalent((prev) => ({
      ...prev,
      [talentId]: {
        ...prev[talentId],
        deliverables: [...prev[talentId].deliverables, emptyDeliverable()],
      },
    }));
  }

  function removeDeliverable(talentId, deliverableId) {
    setParticipantsByTalent((prev) => ({
      ...prev,
      [talentId]: {
        ...prev[talentId],
        deliverables: prev[talentId].deliverables.filter((d) => d.id !== deliverableId),
      },
    }));
  }

  function updateDeliverable(talentId, deliverableId, patch) {
    setParticipantsByTalent((prev) => ({
      ...prev,
      [talentId]: {
        ...prev[talentId],
        deliverables: prev[talentId].deliverables.map((d) =>
          d.id === deliverableId ? { ...d, ...patch } : d
        ),
      },
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const errors = {};
    if (!clientId) errors.client = COPY.form.errors.clientRequired;
    if (!brandId) errors.brand = COPY.form.errors.brandRequired;
    if (!name.trim()) errors.name = COPY.form.errors.nameRequired;
    if (selectedTalentIds.length === 0) errors.talents = COPY.form.errors.talentsRequired;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const campaign = addCampaign({
      clientId,
      brandId,
      name: name.trim(),
      month: month || null,
      relevantDate: relevantDate || null,
      businessStatus,
      // Operational status of a brand-new campaign starts at the beginning
      // of the pipeline; approval reflects the future EMPLOYEE→OWNER flow
      // (visual only in this sprint) — a new campaign is a Draft.
      operationalStatus: OPERATIONAL_STATUS.WAITING_CONTENT,
      approvalStatus: APPROVAL_STATUS.DRAFT,
      notes: [],
      participants: selectedTalentIds.map((talentId) => ({
        talentId,
        operationalStatus: participantsByTalent[talentId].operationalStatus,
        notes: participantsByTalent[talentId].notes,
        // All rows are kept — a deliverable like "2× רצף סטוריז" with no
        // free-text description is valid; only the description is trimmed.
        deliverables: participantsByTalent[talentId].deliverables.map((d) => ({
          ...d,
          description: d.description.trim(),
        })),
      })),
    });

    onCreated(campaign);
  }

  return (
    <Card title={COPY.form.title}>
      <form className={styles.createForm} onSubmit={handleSubmit}>
        <p className={styles.mutedNote}>{COPY.form.note}</p>

        <div className={styles.fieldGrid}>
          {/* Required order: Client → Brand → Campaign name. */}
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{COPY.form.fields.client}</span>
              <select
                className={styles.select}
                value={clientId}
                onChange={(event) => handleClientChange(event.target.value)}
              >
                <option value="">{COPY.form.fields.clientPlaceholder}</option>
                {DEMO_CLIENTS.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              {fieldErrors.client ? (
                <span className={styles.fieldError}>{fieldErrors.client}</span>
              ) : null}
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>{COPY.form.fields.brand}</span>
              <select
                className={styles.select}
                value={brandId}
                disabled={!clientId}
                onChange={(event) => {
                  setBrandId(event.target.value);
                  clearFieldError("brand");
                }}
              >
                <option value="">
                  {clientId ? COPY.form.fields.brandPlaceholder : COPY.form.fields.brandDisabledHint}
                </option>
                {brandOptions.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
              {fieldErrors.brand ? (
                <span className={styles.fieldError}>{fieldErrors.brand}</span>
              ) : null}
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{COPY.form.fields.name}</span>
            <input
              type="text"
              className={styles.input}
              value={name}
              placeholder={COPY.form.fields.namePlaceholder}
              onChange={(event) => {
                setName(event.target.value);
                clearFieldError("name");
              }}
            />
            {fieldErrors.name ? <span className={styles.fieldError}>{fieldErrors.name}</span> : null}
          </label>

          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{COPY.form.fields.month}</span>
              <input
                type="month"
                dir="ltr"
                className={styles.input}
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              {/* Provisional field — meaning not finalized, see copy.js. */}
              <span className={styles.fieldLabel}>{COPY.form.fields.relevantDate}</span>
              <input
                type="date"
                dir="ltr"
                className={styles.input}
                value={relevantDate}
                onChange={(event) => setRelevantDate(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>{COPY.form.fields.businessStatus}</span>
              <select
                className={styles.select}
                value={businessStatus}
                onChange={(event) => setBusinessStatus(event.target.value)}
              >
                {Object.values(BUSINESS_STATUS).map((status) => (
                  <option key={status} value={status}>
                    {COPY.businessStatus[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>{COPY.form.fields.talents}</span>
            <span className={styles.fieldHint}>{COPY.form.fields.talentsHint}</span>
            <div className={styles.talentChecks}>
              {DEMO_TALENTS.map((talent) => {
                const selected = Boolean(participantsByTalent[talent.id]);
                const preselected = preselectedTalentIds.includes(talent.id);
                return (
                  <label
                    key={talent.id}
                    className={
                      selected
                        ? `${styles.talentCheck} ${styles.talentCheckSelected}`
                        : styles.talentCheck
                    }
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleTalent(talent.id)}
                    />
                    {talent.name}
                    {preselected ? (
                      <span className={styles.preselectedTag}>
                        {COPY.form.fields.currentTalentTag}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
            {fieldErrors.talents ? (
              <span className={styles.fieldError}>{fieldErrors.talents}</span>
            ) : null}
          </div>

          {/* Per-talent deliverables + operational status. */}
          {selectedTalentIds.map((talentId) => {
            const talent = DEMO_TALENTS.find((t) => t.id === talentId);
            const participant = participantsByTalent[talentId];
            return (
              <div key={talentId} className={styles.perTalentBlock}>
                <p className={styles.perTalentTitle}>
                  {COPY.form.perTalent.title(talent?.name || talentId)}
                </p>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>
                    {COPY.form.perTalent.operationalStatus}
                  </span>
                  <select
                    className={styles.select}
                    value={participant.operationalStatus}
                    onChange={(event) =>
                      updateParticipant(talentId, { operationalStatus: event.target.value })
                    }
                  >
                    {Object.values(OPERATIONAL_STATUS).map((status) => (
                      <option key={status} value={status}>
                        {COPY.operationalStatus[status]}
                      </option>
                    ))}
                  </select>
                </label>

                {participant.deliverables.length === 0 ? (
                  <p className={styles.mutedNote}>{COPY.form.perTalent.noDeliverables}</p>
                ) : (
                  participant.deliverables.map((deliverable) => (
                    <div key={deliverable.id} className={styles.deliverableEditRow}>
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>{COPY.form.perTalent.type}</span>
                        <select
                          className={styles.select}
                          value={deliverable.type}
                          onChange={(event) =>
                            updateDeliverable(talentId, deliverable.id, {
                              type: event.target.value,
                            })
                          }
                        >
                          {Object.values(DELIVERABLE_TYPE).map((type) => (
                            <option key={type} value={type}>
                              {COPY.deliverableType[type]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>{COPY.form.perTalent.quantity}</span>
                        <input
                          type="number"
                          min="1"
                          dir="ltr"
                          className={styles.quantityInput}
                          value={deliverable.quantity}
                          onChange={(event) =>
                            updateDeliverable(talentId, deliverable.id, {
                              quantity: Math.max(1, Number(event.target.value) || 1),
                            })
                          }
                        />
                      </label>

                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>
                          {COPY.form.perTalent.description}
                        </span>
                        <input
                          type="text"
                          className={styles.input}
                          value={deliverable.description}
                          onChange={(event) =>
                            updateDeliverable(talentId, deliverable.id, {
                              description: event.target.value,
                            })
                          }
                        />
                      </label>

                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>
                          {COPY.form.perTalent.deliverableStatus}
                        </span>
                        <select
                          className={styles.select}
                          value={deliverable.status}
                          onChange={(event) =>
                            updateDeliverable(talentId, deliverable.id, {
                              status: event.target.value,
                            })
                          }
                        >
                          {Object.values(OPERATIONAL_STATUS).map((status) => (
                            <option key={status} value={status}>
                              {COPY.operationalStatus[status]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        type="button"
                        className={styles.removeButton}
                        onClick={() => removeDeliverable(talentId, deliverable.id)}
                      >
                        {COPY.form.perTalent.removeDeliverable}
                      </button>
                    </div>
                  ))
                )}

                <div>
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => addDeliverable(talentId)}
                  >
                    {COPY.form.perTalent.addDeliverable}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.formActions}>
          <SecondaryButton type="button" onClick={onCancel}>
            {COPY.form.cancel}
          </SecondaryButton>
          <PrimaryButton type="submit">{COPY.form.submit}</PrimaryButton>
        </div>
      </form>
    </Card>
  );
}
