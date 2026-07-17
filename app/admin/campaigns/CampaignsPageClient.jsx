"use client";

/*
 * CampaignsPageClient — Sprint 8A (Campaigns UI Prototype). PROTOTYPE ONLY.
 *
 * The interactive Campaigns list: search, lightweight filters (month /
 * client / brand / business status), the New Campaign inline form, and the
 * campaigns table. Reads and writes ONLY the in-memory prototype store —
 * no fetch(), no API routes, no persistence.
 *
 * Column order is a product decision from the sprint brief and must stay:
 * Client → Brand → Campaign → Month → Status → #Talents. Campaign is
 * deliberately NOT the first column — the business hierarchy starts at the
 * Client.
 *
 * Navigation to campaign detail uses router.push (client-side) rather than
 * a plain <a>, so campaigns created locally in this session stay visible
 * on their detail page (the store lives in JS module memory — a full page
 * load would reset it; see the store's header comment).
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/admin/Card";
import PrimaryButton from "@/components/admin/PrimaryButton";
import SecondaryButton from "@/components/admin/SecondaryButton";
import StatusBadge from "@/components/admin/StatusBadge";
import EmptyState from "@/components/admin/EmptyState";
import NewCampaignForm from "./NewCampaignForm";
import {
  listCampaigns,
  getClientById,
  getBrandById,
  formatCampaignMonth,
  DEMO_CLIENTS,
  BUSINESS_STATUS,
} from "./_prototype/campaignPrototypeData";
import { campaignsCopy as COPY } from "./_prototype/copy";
import styles from "./campaigns.module.css";

const FILTER_ALL = "ALL";

function matchesSearch(campaign, query) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const client = getClientById(campaign.clientId);
  const brand = getBrandById(campaign.clientId, campaign.brandId);
  return (
    campaign.name.toLowerCase().includes(q) ||
    (client?.name || "").toLowerCase().includes(q) ||
    (brand?.name || "").toLowerCase().includes(q)
  );
}

export default function CampaignsPageClient() {
  const router = useRouter();

  // The store itself is module-scope; this state is just a re-render
  // trigger — bump it after a mutation so the list re-reads the store.
  const [storeVersion, setStoreVersion] = useState(0);
  const campaigns = useMemo(() => listCampaigns(), [storeVersion]);

  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState(FILTER_ALL);
  const [clientFilter, setClientFilter] = useState(FILTER_ALL);
  const [brandFilter, setBrandFilter] = useState(FILTER_ALL);
  const [statusFilter, setStatusFilter] = useState(FILTER_ALL);
  const [createOpen, setCreateOpen] = useState(false);

  // Month options derived from whatever campaigns currently exist.
  const monthOptions = useMemo(() => {
    const months = [...new Set(campaigns.map((campaign) => campaign.month))];
    months.sort();
    return months;
  }, [campaigns]);

  // Brand filter options follow the selected client filter (or all brands).
  const brandOptions = useMemo(() => {
    const clients =
      clientFilter === FILTER_ALL
        ? DEMO_CLIENTS
        : DEMO_CLIENTS.filter((client) => client.id === clientFilter);
    return clients.flatMap((client) => client.brands);
  }, [clientFilter]);

  function handleClientFilterChange(value) {
    setClientFilter(value);
    // A brand belonging to a different client can't stay selected.
    setBrandFilter(FILTER_ALL);
  }

  const hasActiveFilters =
    monthFilter !== FILTER_ALL ||
    clientFilter !== FILTER_ALL ||
    brandFilter !== FILTER_ALL ||
    statusFilter !== FILTER_ALL ||
    search.trim() !== "";

  function clearFilters() {
    setSearch("");
    setMonthFilter(FILTER_ALL);
    setClientFilter(FILTER_ALL);
    setBrandFilter(FILTER_ALL);
    setStatusFilter(FILTER_ALL);
  }

  const visibleCampaigns = campaigns.filter((campaign) => {
    if (!matchesSearch(campaign, search)) return false;
    if (monthFilter !== FILTER_ALL && campaign.month !== monthFilter) return false;
    if (clientFilter !== FILTER_ALL && campaign.clientId !== clientFilter) return false;
    if (brandFilter !== FILTER_ALL && campaign.brandId !== brandFilter) return false;
    if (statusFilter !== FILTER_ALL && campaign.businessStatus !== statusFilter) return false;
    return true;
  });

  function openCampaign(id) {
    router.push(`/admin/campaigns/${id}`);
  }

  function handleCreated(campaign) {
    setCreateOpen(false);
    setStoreVersion((v) => v + 1);
    openCampaign(campaign.id);
  }

  return (
    <div className={styles.tokens}>
      <p className={styles.prototypeNote}>{COPY.prototypeNote}</p>

      <div className={styles.actionsRow}>
        <div className={styles.toolbar}>
          <input
            type="search"
            className={styles.searchInput}
            value={search}
            placeholder={COPY.searchPlaceholder}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            className={styles.filterSelect}
            value={monthFilter}
            aria-label={COPY.filters.month}
            onChange={(event) => setMonthFilter(event.target.value)}
          >
            <option value={FILTER_ALL}>{`${COPY.filters.month}: ${COPY.filters.all}`}</option>
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {formatCampaignMonth(month)}
              </option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={clientFilter}
            aria-label={COPY.filters.client}
            onChange={(event) => handleClientFilterChange(event.target.value)}
          >
            <option value={FILTER_ALL}>{`${COPY.filters.client}: ${COPY.filters.all}`}</option>
            {DEMO_CLIENTS.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={brandFilter}
            aria-label={COPY.filters.brand}
            onChange={(event) => setBrandFilter(event.target.value)}
          >
            <option value={FILTER_ALL}>{`${COPY.filters.brand}: ${COPY.filters.all}`}</option>
            {brandOptions.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={statusFilter}
            aria-label={COPY.filters.status}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value={FILTER_ALL}>{`${COPY.filters.status}: ${COPY.filters.all}`}</option>
            {Object.values(BUSINESS_STATUS).map((status) => (
              <option key={status} value={status}>
                {COPY.businessStatus[status]}
              </option>
            ))}
          </select>

          {hasActiveFilters ? (
            <button type="button" className={styles.linkButton} onClick={clearFilters}>
              {COPY.filters.clear}
            </button>
          ) : null}
        </div>

        {!createOpen ? (
          <PrimaryButton type="button" onClick={() => setCreateOpen(true)}>
            {COPY.newCampaign}
          </PrimaryButton>
        ) : null}
      </div>

      {createOpen ? (
        <NewCampaignForm onCreated={handleCreated} onCancel={() => setCreateOpen(false)} />
      ) : null}

      {campaigns.length === 0 ? (
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
      ) : visibleCampaigns.length === 0 ? (
        <EmptyState title={COPY.noSearchResults} />
      ) : (
        <Card>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{COPY.table.client}</th>
                  <th>{COPY.table.brand}</th>
                  <th>{COPY.table.campaign}</th>
                  <th>{COPY.table.month}</th>
                  <th>{COPY.table.status}</th>
                  <th>{COPY.table.talentsCount}</th>
                  <th>{COPY.table.actions}</th>
                </tr>
              </thead>
              <tbody>
                {visibleCampaigns.map((campaign) => {
                  const client = getClientById(campaign.clientId);
                  const brand = getBrandById(campaign.clientId, campaign.brandId);
                  return (
                    <tr
                      key={campaign.id}
                      className={styles.clickableRow}
                      onClick={() => openCampaign(campaign.id)}
                    >
                      <td>{client?.name || "—"}</td>
                      <td>{brand?.name || "—"}</td>
                      <td className={styles.nameCell}>{campaign.name}</td>
                      <td>{formatCampaignMonth(campaign.month)}</td>
                      <td>
                        {/* Business + operational stay separate concepts:
                            badge = business, muted line = operational. */}
                        <div className={styles.statusCell}>
                          <StatusBadge
                            label={COPY.businessStatus[campaign.businessStatus]}
                            tone={COPY.businessStatusTone[campaign.businessStatus]}
                          />
                          <span className={styles.mutedNote}>
                            {COPY.operationalStatus[campaign.operationalStatus]}
                          </span>
                        </div>
                      </td>
                      <td>{campaign.participants.length}</td>
                      <td>
                        <SecondaryButton
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openCampaign(campaign.id);
                          }}
                        >
                          {COPY.table.view}
                        </SecondaryButton>
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
