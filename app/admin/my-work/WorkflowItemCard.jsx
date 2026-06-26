/*
 * WorkflowItemCard — Phase 2 (Agency Workflow), "My Work" page.
 *
 * Renders a single workflow item (see lib/admin/mock-workflow.js) as a
 * Card. Local to app/admin/my-work/ rather than components/admin/ for now
 * since it's a one-page-only composition of existing primitives (Card,
 * StatusBadge) with no proven need elsewhere yet — promote it to
 * components/admin/ if a second page needs the same item shape.
 *
 * Plain presentational component — no "use client", no hooks.
 */

import Card from "@/components/admin/Card";
import StatusBadge from "@/components/admin/StatusBadge";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/admin/mock-workflow";
import styles from "./my-work.module.css";

function formatDate(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function WorkflowItemCard({ item }) {
  return (
    <Card>
      <div className={styles.itemHeader}>
        <h3 className={styles.itemTitle}>{item.title}</h3>
        <StatusBadge label={STATUS_LABEL[item.status] || item.status} tone={STATUS_TONE[item.status]} />
      </div>

      <div className={styles.itemMeta}>
        <span className={styles.metaTag}>{item.type}</span>
        <span className={styles.metaDot} aria-hidden="true">
          •
        </span>
        <span>Updated {formatDate(item.lastUpdated)}</span>
        {item.owner ? (
          <>
            <span className={styles.metaDot} aria-hidden="true">
              •
            </span>
            <span>{item.owner}</span>
          </>
        ) : null}
      </div>

      {item.description ? <p className={styles.itemDescription}>{item.description}</p> : null}
    </Card>
  );
}
