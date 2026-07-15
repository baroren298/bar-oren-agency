"use client";

/*
 * AuditLogPageClient — Administration Sprint 2c (Audit Log module),
 * revised by the Sprint 2c UI-polish pass (presentation only — data
 * fetching, authorization, pagination, and the safe-DTO boundary are
 * untouched from the functional sprint).
 *
 * The interactive pieces of /admin/audit-log, deliberately minimal (no
 * generic table framework, no filters/search/export — out of scope):
 *
 *   - Renders the narrative list (newest first, as delivered by the
 *     server) via lib/admin/audit-log-display.js's pure projection.
 *   - Per-row expand/collapse for the allowlisted technical details; rows
 *     with no safe details render no expand control at all.
 *   - "Load more" pagination against GET /api/admin/audit-log using the
 *     server-provided cursor, with loading and failure states. A fetch
 *     failure shows a generic retryable message (he.auditLog.loadError) —
 *     never error internals.
 *
 * UI-polish pass details:
 *   - Badges are page-local <span>s styled per buildActionBadgeVariant's
 *     vocabulary (audit-log.module.css) — the shared StatusBadge's five
 *     generic tones couldn't express the approved action-color mapping,
 *     and changing that shared component would ripple to other pages.
 *     The text label always renders; color never carries meaning alone.
 *   - One small inline-SVG icon per row (EVENT_ICONS), decorative only:
 *     aria-hidden, since the narrative + badge already carry the
 *     information. Unknown events get the safe generic icon via
 *     buildIconKey's fallback.
 *   - Relative timestamps, hydration-safe: the server (and the client's
 *     first render) always show the exact "20:09 · 15.07.2026" form; a
 *     `mounted` flag flipped in useEffect — the standard two-pass pattern —
 *     swaps in the Hebrew relative label as the primary text AFTER
 *     hydration, keeping the exact form as secondary text and as the
 *     row's title/tooltip. No intervals; the label is computed once per
 *     render from a single Date.now() call. Entries older than yesterday
 *     keep the exact date as primary (formatRelativeTime returns null).
 *
 * READ-ONLY: there is no mutation call anywhere in this file.
 *
 * Props:
 *   - initialEntries (array, required) — first page of auditLogService
 *     safe DTOs, from page.jsx's server-side read.
 *   - initialNextCursor (string|null, required) — cursor for page 2, or
 *     null when there is nothing more to load.
 */

import { useEffect, useState } from "react";
import Card from "@/components/admin/Card";
import SecondaryButton from "@/components/admin/SecondaryButton";
import EmptyState from "@/components/admin/EmptyState";
import { buildAuditLogDisplayItems, formatRelativeTime } from "@/lib/admin/audit-log-display";
import { he } from "@/lib/admin/i18n/he";
import styles from "./audit-log.module.css";

const COPY = he.auditLog;

/*
 * Decorative event icons — one consistent 16px stroke set (matches the
 * admin design system's restrained line weight), keyed by
 * buildIconKey's vocabulary. Inline SVG on purpose: no icon library
 * (sprint constraint), no emoji. All aria-hidden — see header.
 */
const ICON_PROPS = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.5",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: "false",
};

const EVENT_ICONS = {
  // person — user/account events
  user: (
    <svg {...ICON_PROPS}>
      <circle cx="8" cy="5" r="2.6" />
      <path d="M2.8 13.6c.9-2.3 2.9-3.5 5.2-3.5s4.3 1.2 5.2 3.5" />
    </svg>
  ),
  // pencil — edit/update
  edit: (
    <svg {...ICON_PROPS}>
      <path d="M11.1 2.4l2.5 2.5-8.3 8.3-3 .5.5-3z" />
    </svg>
  ),
  // key — password/security
  security: (
    <svg {...ICON_PROPS}>
      <circle cx="5" cy="11" r="2.8" />
      <path d="M7.1 8.9L13.5 2.5M11 5l2 2M9 7l1.5 1.5" />
    </svg>
  ),
  // check — approval/activation
  approve: (
    <svg {...ICON_PROPS}>
      <path d="M2.8 8.6l3.4 3.4 7-7.6" />
    </svg>
  ),
  // circle-slash — rejection/deactivation/deletion
  reject: (
    <svg {...ICON_PROPS}>
      <circle cx="8" cy="8" r="5.6" />
      <path d="M4.2 4.2l7.6 7.6" />
    </svg>
  ),
  // up-arrow from tray — publish (future ActionType, hook ready)
  publish: (
    <svg {...ICON_PROPS}>
      <path d="M8 10.5V2.8M4.8 6l3.2-3.2L11.2 6M2.8 13.2h10.4" />
    </svg>
  ),
  // document — safe generic/system event
  generic: (
    <svg {...ICON_PROPS}>
      <path d="M4 1.8h5.5L12 4.3v9.9H4z" />
      <path d="M9.5 1.8v2.5H12" />
    </svg>
  ),
};

function formatExactDateTime(value) {
  if (!value) return COPY.details.emptyValue;
  try {
    const date = new Date(value);
    // "20:09 · 15.07.2026" — time first (the more interesting part for an
    // audit row), then the he-IL short date.
    const time = date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
    const day = date.toLocaleDateString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return `${time} · ${day}`;
  } catch {
    return COPY.details.emptyValue;
  }
}

/**
 * Hydration-safe timestamp: exact form on the server pass and the first
 * client render; relative label (when one applies) only after mount.
 */
function EntryTimestamp({ createdAt, mounted }) {
  const exact = formatExactDateTime(createdAt);
  const relative = mounted ? formatRelativeTime(createdAt, Date.now()) : null;

  if (!relative) {
    return (
      <span className={styles.timestamp} title={exact}>
        {exact}
      </span>
    );
  }
  return (
    <span className={styles.timestamp} title={exact}>
      {relative}
      <span className={styles.timestampExact}>{exact}</span>
    </span>
  );
}

export default function AuditLogPageClient({ initialEntries, initialNextCursor }) {
  const [entries, setEntries] = useState(initialEntries || []);
  const [nextCursor, setNextCursor] = useState(initialNextCursor ?? null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const items = buildAuditLogDisplayItems(entries);

  function toggleExpanded(id) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);

    try {
      const response = await fetch(
        `/api/admin/audit-log?cursor=${encodeURIComponent(nextCursor)}`
      );
      if (!response.ok) {
        setLoadError(COPY.loadError);
        return;
      }
      const data = await response.json();
      setEntries((current) => [...current, ...(data.entries || [])]);
      setNextCursor(data.nextCursor ?? null);
    } catch {
      setLoadError(COPY.loadError);
    } finally {
      setLoadingMore(false);
    }
  }

  if (items.length === 0) {
    return <EmptyState title={COPY.emptyTitle} description={COPY.emptyDescription} />;
  }

  return (
    <div className={styles.tokens}>
      <Card>
        <ul className={styles.list}>
          {items.map((item) => {
            const expanded = expandedIds.has(item.id);
            const hasDetails = item.detailRows.length > 0;
            const icon = EVENT_ICONS[item.iconKey] || EVENT_ICONS.generic;
            const badgeClass = styles[`badge_${item.badgeVariant}`] || styles.badge_neutral;

            return (
              <li key={item.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.eventIcon}>{icon}</span>

                  <div className={styles.rowText}>
                    <p className={styles.narrative}>{item.narrative}</p>
                    <EntryTimestamp createdAt={item.createdAt} mounted={mounted} />
                  </div>

                  <div className={styles.rowSide}>
                    <span className={`${styles.badge} ${badgeClass}`}>{item.badge}</span>
                    {hasDetails ? (
                      <button
                        type="button"
                        className={styles.detailsToggle}
                        onClick={() => toggleExpanded(item.id)}
                        aria-expanded={expanded}
                      >
                        {expanded ? COPY.detailsToggleHide : COPY.detailsToggleShow}
                        <svg
                          {...ICON_PROPS}
                          className={
                            expanded
                              ? `${styles.chevron} ${styles.chevronOpen}`
                              : styles.chevron
                          }
                        >
                          <path d="M4 6l4 4 4-4" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                </div>

                {expanded && hasDetails ? (
                  <dl className={styles.detailsPanel}>
                    {item.detailRows.map((row) => (
                      <div key={row.label} className={styles.detailRow}>
                        <dt className={styles.detailLabel}>{row.label}</dt>
                        <dd className={styles.detailValue}>{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      {loadError ? <p className={styles.loadError}>{loadError}</p> : null}

      {nextCursor ? (
        <div className={styles.loadMoreRow}>
          <SecondaryButton onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? COPY.loadingMore : loadError ? COPY.retry : COPY.loadMore}
          </SecondaryButton>
        </div>
      ) : null}
    </div>
  );
}
