/*
 * History timeline default-length limit — pure presentation-layer helper
 * for components/admin/Timeline.jsx.
 *
 * A talent can accumulate many Event rows over the years (Sprint 2: Real
 * Event-Based History Timeline never deletes or excludes anything from
 * persistence — see lib/admin/talent-history.js's header). Showing all of
 * them by default makes the History tab unnecessarily long, so this module
 * provides the slice-for-display logic: show the newest DEFAULT_VISIBLE
 * items, with an explicit "show all" / "show less" toggle.
 *
 * Deliberately separate from lib/admin/talent-history.js: that module's
 * buildEventTimelineItems / buildTalentHistoryTimelineItems already own the
 * event → timeline-item projection (noise policy, actor resolution,
 * newest-first sort, version-row fallback) and are NOT duplicated or
 * re-implemented here. This module only decides, given an already-built,
 * already-ordered `items` array, how many to render — a pure slice, no
 * sorting, no filtering, no I/O. It applies identically whether `items`
 * came from the event-based projection or the version-row fallback, since
 * both return the same `{ id, action, date, user, summary, tone }` shape in
 * newest-first order.
 *
 * NOTE — V1 scope: the caller (app/admin/talent/[id]/page.jsx) still loads
 * every Event row for the entity via eventRepository.listForEntity and
 * projects all of them before this module slices client-side. That's
 * acceptable for this sprint's data volumes. If histories grow large enough
 * for that full load to become a real cost, the fix is true server-side
 * pagination (a windowed repository read + incremental fetch) — explicitly
 * out of scope here; this module does not introduce any pagination, API
 * route, or infinite scroll.
 */

// Number of newest-first timeline items shown before the "הצג היסטוריה
// מלאה" toggle appears (lib/admin/i18n/he.js's he.history.showFullHistory).
export const DEFAULT_VISIBLE_HISTORY_COUNT = 25;

/**
 * Slice an already-ordered (newest-first) timeline items array for display.
 *
 * @param {Array} items - newest-first timeline items (event-based or the
 *   version-row fallback — both shapes are identical downstream).
 * @param {boolean} expanded - whether the caller has toggled "show all".
 * @param {number} [limit] - defaults to DEFAULT_VISIBLE_HISTORY_COUNT.
 * @returns {{ visibleItems: Array, hasMore: boolean }} hasMore is true only
 *   when the full list exceeds `limit` — this is what controls whether the
 *   expand/collapse toggle renders at all (requirement: the control must
 *   not appear when the projected timeline has `limit` items or fewer).
 */
export function sliceTimelineForDisplay(items, expanded, limit = DEFAULT_VISIBLE_HISTORY_COUNT) {
  const list = Array.isArray(items) ? items : [];
  const hasMore = list.length > limit;
  const visibleItems = expanded ? list : list.slice(0, limit);
  return { visibleItems, hasMore };
}
