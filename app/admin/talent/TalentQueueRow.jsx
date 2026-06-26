/*
 * TalentQueueRow — Talent Workspace Foundation sprint.
 *
 * One row of the Talent work-queue list (./page.jsx). Local to
 * app/admin/talent/ rather than components/admin/ for now, same reasoning
 * as app/admin/my-work/WorkflowItemCard.jsx: a one-page composition of
 * existing primitives (Card, StatusBadge) with no proven need elsewhere
 * yet. Plain presentational component — no "use client", no hooks.
 */

import Link from 'next/link';
import Card from '@/components/admin/Card';
import StatusBadge from '@/components/admin/StatusBadge';
import {
  deriveListWorkflowStatus,
  deriveListSummary,
  workflowStatusLabel,
  workflowStatusTone,
} from '@/lib/admin/talent-workspace';
import { he } from '@/lib/admin/i18n/he';
import styles from './talent.module.css';

export default function TalentQueueRow({ talent }) {
  const status = deriveListWorkflowStatus(talent);
  const summary = deriveListSummary(talent);
  const displayName = talent.name || talent.nameEn || talent.slug;

  return (
    <Link href={`/admin/talent/${talent.id}`} className={styles.rowLink}>
      <Card as="article">
        <div className={styles.rowHeader}>
          <h3 className={styles.rowName}>{displayName}</h3>
          <StatusBadge label={workflowStatusLabel(status)} tone={workflowStatusTone(status)} />
        </div>

        <div className={styles.rowMeta}>
          <span>
            {he.talent.meta.lastUpdated}: {he.talent.meta.noDateYet}
          </span>
          <span className={styles.metaDot} aria-hidden="true">
            •
          </span>
          <span>{talent.slug}</span>
        </div>

        <p className={styles.rowSummary}>{summary}</p>
      </Card>
    </Link>
  );
}
