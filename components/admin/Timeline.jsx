"use client";

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
 * Strictly presentational — no fetching, no filtering, no persistence.
 * Renders an <EmptyState> when there's nothing to show.
 *
 * Long-history default-length limit sprint: `items` can span years of
 * lifecycle events, so this component now shows only the newest
 * DEFAULT_VISIBLE_HISTORY_COUNT by default and reveals a "הצג היסטוריה
 * מלאה" toggle when there are more (lib/admin/timeline-display.js's
 * sliceTimelineForDisplay — the actual slicing logic, kept in a plain
 * pure-function module so it's unit-testable without rendering). This is a
 * presentation-layer slice over whatever `items` the caller already
 * loaded — no new fetch, no API route, no pagination. Every item the
 * caller passed in was already loaded from the database (see
 * lib/admin/talent-history.js / eventRepository); this component only
 * decides how many of them to render at once. "use client" is required for
 * the useState toggle — this is the only reason this component is now a
 * Client Component (it was previously server-rendered).
 *
 * NOTE: this loads/receives the entity's *entire* projected timeline and
 * slices it client-side. That's an acceptable V1 given today's event
 * volumes. If a talent's history grows large enough that loading every
 * Event row becomes a real cost, the fix is true server-side pagination
 * (a windowed repository read + "load more" fetch) — deliberately out of
 * scope for this sprint; see repository/eventRepository.js's
 * listForEntity for where that would plug in.
 *
 * Props:
 *   - items ({ id, action, date, user, summary, tone }[]) — newest first.
 *     `action` is a human label (already resolved, e.g. via
 *     lib/admin/mock-history.js's ACTION_LABEL), `tone` matches
 *     StatusBadge's tone prop.
 */

import { useState } from "react";
import StatusBadge from "./StatusBadge";
import EmptyState from "./EmptyState";
import SecondaryButton from "./SecondaryButton";
import { he } from "@/lib/admin/i18n/he";
import { formatHebrewDate } from "@/lib/admin/talent-workspace";
import { sliceTimelineForDisplay } from "@/lib/admin/timeline-display";
import styles from "./Timeline.module.css";

function formatHebrewTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

export default function Timeline({ items = [] }) {
  const [expanded, setExpanded] = useState(false);

  if (!items.length) {
    return (
      <EmptyState title={he.history.emptyTitle} description={he.history.emptyDescription} />
    );
  }

  // Items are expected newest-first already (both projections sort/order
  // that way); this component never re-sorts, it only slices.
  const { visibleItems, hasMore } = sliceTimelineForDisplay(items, expanded);

  return (
    <div className={styles.tokens}>
      <p className={styles.intro}>{he.history.intro}</p>

      <ol className={styles.list}>
        {visibleItems.map((item) => {
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

      {hasMore ? (
        <div className={styles.toggleRow}>
          <SecondaryButton type="button" onClick={() => setExpanded((current) => !current)}>
            {expanded ? he.history.showLess : he.history.showFullHistory}
          </SecondaryButton>
        </div>
      ) : null}
    </div>
  );
}
