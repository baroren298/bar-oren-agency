"use client";

/*
 * TalentCampaignsTab — Sprint 8A (Campaigns UI Prototype). PROTOTYPE ONLY.
 *
 * The "קמפיינים" tab inside a represented talent's workspace
 * (app/admin/talent/[id]). Shows only campaigns connected to that talent,
 * with the sprint's required column order: Client → Brand → Campaign →
 * Month → that talent's media mix → that talent's status.
 *
 * DEMO ALIASING — deliberate prototype behavior: campaign data is fake and
 * knows nothing about real talents, so whichever real talent profile is
 * open is aliased to a fixed demo talent
 * (CURRENT_PROFILE_DEMO_TALENT_ID) — that way the tab always has
 * meaningful demo rows to evaluate, and a visible note explains that the
 * rows are demo data, not this profile's real campaigns.
 *
 * "Add Campaign" opens the SAME NewCampaignForm the main Campaigns page
 * uses, with the (aliased) current talent preselected — more talents can
 * still be added, Client + Brand stay required, and exactly one shared
 * campaign is created (never a per-talent duplicate). Created campaigns go
 * to the same in-memory store, so they also appear in /admin/campaigns.
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
  listCampaignsForTalent,
  getClientById,
  getBrandById,
  formatCampaignMonth,
  formatMediaMix,
  CURRENT_PROFILE_DEMO_TALENT_ID,
} from "./_prototype/campaignPrototypeData";
import { campaignsCopy as COPY } from "./_prototype/copy";
import styles from "./campaigns.module.css";

export default function TalentCampaignsTab() {
  const router = useRouter();
  const [storeVersion, setStoreVersion] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  const talentId = CURRENT_PROFILE_DEMO_TALENT_ID;
  const campaigns = useMemo(() => listCampaignsForTalent(talentId), [storeVersion, talentId]);

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
      <p className={styles.prototypeNote}>{COPY.talentTab.demoNote}</p>

      <div className={styles.tabActions}>
        {!createOpen ? (
          <PrimaryButton type="button" onClick={() => setCreateOpen(true)}>
            {COPY.talentTab.addCampaign}
          </PrimaryButton>
        ) : null}
      </div>

      {createOpen ? (
        <NewCampaignForm
          preselectedTalentIds={[talentId]}
          onCreated={handleCreated}
          onCancel={() => setCreateOpen(false)}
        />
      ) : null}

      {campaigns.length === 0 ? (
        <EmptyState title={COPY.talentTab.empty} />
      ) : (
        <Card>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{COPY.talentTab.table.client}</th>
                  <th>{COPY.talentTab.table.brand}</th>
                  <th>{COPY.talentTab.table.campaign}</th>
                  <th>{COPY.talentTab.table.month}</th>
                  <th>{COPY.talentTab.table.mediaMix}</th>
                  <th>{COPY.talentTab.table.status}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => {
                  const client = getClientById(campaign.clientId);
                  const brand = getBrandById(campaign.clientId, campaign.brandId);
                  const participant = campaign.participants.find(
                    (p) => p.talentId === talentId
                  );
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
                      <td>{formatMediaMix(participant, COPY.deliverableType)}</td>
                      <td>
                        {participant ? (
                          <StatusBadge
                            label={COPY.operationalStatus[participant.operationalStatus]}
                            tone={COPY.operationalStatusTone[participant.operationalStatus]}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <SecondaryButton
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openCampaign(campaign.id);
                          }}
                        >
                          {COPY.talentTab.table.view}
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
