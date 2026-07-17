"use client";

/*
 * CampaignDetailClient — Sprint 8A (Campaigns UI Prototype). PROTOTYPE ONLY.
 *
 * The campaign workspace: hierarchy line (Client ‹ Brand ‹ Campaign),
 * header with the separated status chips (business / operational /
 * approval — deliberately three concepts, never merged), and five tabs:
 * פרטים / מיוצגים / תוצרים / הערות / היסטוריה. Tab structure mirrors the
 * talent workspace (TalentWorkspaceTabs) but is duplicated locally — the
 * prototype must not import talent-detail styles or components it doesn't
 * own. The tab list is provisional per the sprint brief.
 *
 * Everything reads from the in-memory prototype store. The only "write" is
 * the Notes tab's add-note, which appends to the same store (in-memory,
 * gone on refresh — allowed by the sprint).
 *
 * The "תאריך רלוונטי (שדה זמני)" field is intentionally provisional — its
 * business meaning (it is NOT a publication date) has not been finalized.
 */

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import Card from "@/components/admin/Card";
import StatusBadge from "@/components/admin/StatusBadge";
import EmptyState from "@/components/admin/EmptyState";
import PrimaryButton from "@/components/admin/PrimaryButton";
import {
  getCampaign,
  addCampaignNote,
  getClientById,
  getBrandById,
  getTalentById,
  formatCampaignMonth,
  formatCampaignDate,
  formatMediaMix,
} from "../_prototype/campaignPrototypeData";
import { campaignsCopy as COPY } from "../_prototype/copy";
import styles from "../campaigns.module.css";

const TAB_KEYS = ["details", "talents", "deliverables", "notes", "history"];

function DetailsTab({ campaign, client, brand }) {
  const rows = [
    [COPY.detail.fields.client, client?.name || "—"],
    [COPY.detail.fields.brand, brand?.name || "—"],
    [COPY.detail.fields.name, campaign.name],
    [COPY.detail.fields.month, formatCampaignMonth(campaign.month)],
    [COPY.detail.fields.relevantDate, formatCampaignDate(campaign.relevantDate)],
    [COPY.detail.fields.talentsCount, String(campaign.participants.length)],
  ];

  return (
    <Card>
      <div className={styles.detailRows}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.detailRow}>
            <span className={styles.detailLabel}>{label}</span>
            <span className={styles.detailValue}>{value}</span>
          </div>
        ))}
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>{COPY.detail.fields.businessStatus}</span>
          <StatusBadge
            label={COPY.businessStatus[campaign.businessStatus]}
            tone={COPY.businessStatusTone[campaign.businessStatus]}
          />
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>{COPY.detail.fields.operationalStatus}</span>
          <StatusBadge
            label={COPY.operationalStatus[campaign.operationalStatus]}
            tone={COPY.operationalStatusTone[campaign.operationalStatus]}
          />
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>{COPY.detail.fields.approvalStatus}</span>
          <StatusBadge
            label={COPY.approvalStatus[campaign.approvalStatus]}
            tone={COPY.approvalStatusTone[campaign.approvalStatus]}
          />
        </div>
      </div>
    </Card>
  );
}

/* Each represented talent gets their own participation card: media mix,
   own operational status, own deliverables, own notes. */
function TalentsTab({ campaign }) {
  if (campaign.participants.length === 0) {
    return <EmptyState title={COPY.detail.talents.empty} />;
  }

  return (
    <div className={styles.participantStack}>
      {campaign.participants.map((participant) => {
        const talent = getTalentById(participant.talentId);
        return (
          <Card key={participant.talentId}>
            <div className={styles.participantHeader}>
              <p className={styles.participantName}>{talent?.name || participant.talentId}</p>
              <StatusBadge
                label={COPY.operationalStatus[participant.operationalStatus]}
                tone={COPY.operationalStatusTone[participant.operationalStatus]}
              />
            </div>

            <div className={styles.participantMeta}>
              <span>
                {COPY.detail.talents.mediaMix}:{" "}
                {formatMediaMix(participant, COPY.deliverableType)}
              </span>
              <span>
                {COPY.detail.talents.notes}:{" "}
                {participant.notes || COPY.detail.talents.noNotes}
              </span>
            </div>

            {participant.deliverables.length > 0 ? (
              <div className={styles.deliverableList}>
                <span className={styles.mutedNote}>{COPY.detail.talents.deliverablesTitle}</span>
                {participant.deliverables.map((deliverable) => (
                  <div key={deliverable.id} className={styles.deliverableRow}>
                    <span className={styles.deliverableType}>
                      {COPY.deliverableType[deliverable.type]}
                    </span>
                    <span className={styles.deliverableQuantity}>× {deliverable.quantity}</span>
                    <span className={styles.deliverableDescription}>
                      {deliverable.description || "—"}
                    </span>
                    <StatusBadge
                      label={COPY.operationalStatus[deliverable.status]}
                      tone={COPY.operationalStatusTone[deliverable.status]}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

/* Flat structured view of every deliverable across talents — structured
   fields (type/quantity/description/status/notes), never one free-text
   blob. */
function DeliverablesTab({ campaign }) {
  const rows = campaign.participants.flatMap((participant) =>
    participant.deliverables.map((deliverable) => ({
      participant,
      deliverable,
    }))
  );

  if (rows.length === 0) {
    return <EmptyState title={COPY.detail.deliverables.empty} />;
  }

  return (
    <Card>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{COPY.detail.deliverables.table.talent}</th>
              <th>{COPY.detail.deliverables.table.type}</th>
              <th>{COPY.detail.deliverables.table.quantity}</th>
              <th>{COPY.detail.deliverables.table.description}</th>
              <th>{COPY.detail.deliverables.table.status}</th>
              <th>{COPY.detail.deliverables.table.notes}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ participant, deliverable }) => (
              <tr key={deliverable.id}>
                <td>{getTalentById(participant.talentId)?.name || participant.talentId}</td>
                <td>{COPY.deliverableType[deliverable.type]}</td>
                <td>{deliverable.quantity}</td>
                <td>{deliverable.description || "—"}</td>
                <td>
                  <StatusBadge
                    label={COPY.operationalStatus[deliverable.status]}
                    tone={COPY.operationalStatusTone[deliverable.status]}
                  />
                </td>
                <td>{deliverable.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function NotesTab({ campaign, onNoteAdded }) {
  const [draft, setDraft] = useState("");

  function handleAdd(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    addCampaignNote(campaign.id, draft);
    setDraft("");
    onNoteAdded();
  }

  return (
    <Card>
      {campaign.notes.length === 0 ? (
        <p className={styles.mutedNote}>{COPY.detail.notes.empty}</p>
      ) : (
        <ul className={styles.notesList}>
          {campaign.notes.map((note, index) => (
            <li key={index} className={styles.noteItem}>
              {note}
            </li>
          ))}
        </ul>
      )}

      <form className={styles.noteForm} onSubmit={handleAdd}>
        <textarea
          className={styles.textarea}
          value={draft}
          placeholder={COPY.detail.notes.addPlaceholder}
          onChange={(event) => setDraft(event.target.value)}
        />
        <PrimaryButton type="submit" disabled={!draft.trim()}>
          {COPY.detail.notes.addButton}
        </PrimaryButton>
      </form>
    </Card>
  );
}

function HistoryTab({ campaign }) {
  if (campaign.history.length === 0) {
    return <EmptyState title={COPY.detail.history.empty} />;
  }

  return (
    <Card>
      <ul className={styles.historyList}>
        {campaign.history.map((item) => (
          <li key={item.id} className={styles.historyItem}>
            <span className={styles.historyDate}>{formatCampaignDate(item.date)}</span>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function CampaignDetailClient({ campaignId }) {
  const [activeTab, setActiveTab] = useState(TAB_KEYS[0]);
  // Re-render trigger after in-memory mutations (notes).
  const [, setStoreVersion] = useState(0);

  const campaign = getCampaign(campaignId);

  if (!campaign) {
    return (
      <div className={styles.tokens}>
        <Link href="/admin/campaigns" className={styles.backLink}>
          {COPY.detail.backToList}
        </Link>
        <EmptyState
          title={COPY.detail.notFoundTitle}
          description={COPY.detail.notFoundDescription}
        />
      </div>
    );
  }

  const client = getClientById(campaign.clientId);
  const brand = getBrandById(campaign.clientId, campaign.brandId);

  return (
    <div className={styles.tokens}>
      {/* Client-side Link (not <a>) — keeps the in-memory store alive. */}
      <Link href="/admin/campaigns" className={styles.backLink}>
        {COPY.detail.backToList}
      </Link>

      {/* Hierarchy is immediately visible: Client ‹ Brand ‹ Campaign. */}
      <div className={styles.hierarchy}>
        <span>{client?.name || "—"}</span>
        <span className={styles.hierarchySeparator}>{COPY.detail.hierarchySeparator}</span>
        <span>{brand?.name || "—"}</span>
        <span className={styles.hierarchySeparator}>{COPY.detail.hierarchySeparator}</span>
        <span className={styles.hierarchyCurrent}>{campaign.name}</span>
      </div>

      <PageHeader
        title={campaign.name}
        description={`${COPY.detail.fields.month}: ${formatCampaignMonth(campaign.month)}`}
        action={
          <div className={styles.headerBadges}>
            <StatusBadge
              label={COPY.businessStatus[campaign.businessStatus]}
              tone={COPY.businessStatusTone[campaign.businessStatus]}
            />
            <StatusBadge
              label={COPY.operationalStatus[campaign.operationalStatus]}
              tone={COPY.operationalStatusTone[campaign.operationalStatus]}
            />
            {/* Future EMPLOYEE→OWNER approval workflow — visual only. */}
            <StatusBadge
              label={COPY.approvalStatus[campaign.approvalStatus]}
              tone={COPY.approvalStatusTone[campaign.approvalStatus]}
            />
          </div>
        }
      />

      <p className={styles.prototypeNote}>{COPY.prototypeNote}</p>

      <div className={styles.workspace}>
        <nav className={styles.tabs} role="tablist">
          {TAB_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={key === activeTab}
              className={key === activeTab ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              onClick={() => setActiveTab(key)}
            >
              {COPY.detail.tabs[key]}
            </button>
          ))}
        </nav>

        <div className={styles.tabPanel} role="tabpanel">
          {activeTab === "details" ? (
            <DetailsTab campaign={campaign} client={client} brand={brand} />
          ) : null}
          {activeTab === "talents" ? <TalentsTab campaign={campaign} /> : null}
          {activeTab === "deliverables" ? <DeliverablesTab campaign={campaign} /> : null}
          {activeTab === "notes" ? (
            <NotesTab campaign={campaign} onNoteAdded={() => setStoreVersion((v) => v + 1)} />
          ) : null}
          {activeTab === "history" ? <HistoryTab campaign={campaign} /> : null}
        </div>
      </div>
    </div>
  );
}
