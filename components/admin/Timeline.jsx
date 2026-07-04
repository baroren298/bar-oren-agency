/*
 * Timeline — History Tab Foundation sprint.
 *
 * Read-only, RTL, calm rendering of "what changed, who changed it, and
 * when" for any entity — this sprint only the talent workspace's היסטוריה
 * tab uses it (app/admin/talent/[id]/page.jsx), fed by
 * lib/admin/mock-history.js's mock events. Deliberately entity-agnostic,
 * same reasoning as ComparisonView/MediaGalleryEditor/SocialLinksEditor:
 * this component knows nothing about "talent" specifically, only a flat
 * `items` array, so it can be reused for site content, SEO, or homepage
 * history later without any change here.
 *
 * Strictly presentational — no fetching, no pagination, no filtering, no
 * persistence. Renders an <EmptyState> when there's nothing to show.
 *
 * Props:
 *   - items ({ id, action, date, user, summary, tone }[]) — newest first.
 *     `action` is a human label (already resolved, e.g. via
 *     lib/admin/mock-history.js's ACTION_LABEL), `tone` matches
 *     StatusBadge's tone prop.
 */

import StatusBadge from "./StatusBadge";
import EmptyState from "./EmptyState";
import { he } from "@/lib/admin/i18n/he";
import { formatHebrewDate } from "@/lib/admin/talent-workspace";
import styles from "./Timeline.module.css";

function formatHebrewTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

export default function Timeline({ items = [] }) {
  if (!items.length) {
    return (
      <EmptyState title={he.history.emptyTitle} description={he.history.emptyDescription} />
    );
  }

  return (
    <div className={styles.tokens}>
      <p className={styles.intro}>{he.history.intro}</p>

      <ol className={styles.list}>
        {items.map((item) => {
          const time = formatHebrewTime(item.date);
          return (
            <li key={item.id} className={styles.item}>
              <div className={styles.marker} aria-hidden="true">
                <span className={styles.dot} />
                <span className={styles.line} />
              </div>

              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <StatusBadge label={item.action} tone={item.tone} />
                  <span className={styles.timestamp}>
                    {formatHebrewDate(item.date)}
                    {time ? ` · ${time}` : ""}
                  </span>
                </div>

                <p className={styles.summary}>{item.summary}</p>
                <p className={styles.user}>{item.user}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
