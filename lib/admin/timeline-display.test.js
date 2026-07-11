/*
 * History timeline default-length limit sprint — unit tests for the pure
 * slicing helper in lib/admin/timeline-display.js. No rendering, no DOM:
 * these test the slice-for-display logic components/admin/Timeline.jsx
 * delegates to, same "pure function, plain object fixtures" style as
 * lib/admin/talent-history.test.js.
 */

import { describe, it, expect } from 'vitest';
import { sliceTimelineForDisplay, DEFAULT_VISIBLE_HISTORY_COUNT } from './timeline-display';
import { buildTalentHistoryTimelineItems } from './talent-history';
import { VERSION_STATUS } from './constants/enums';

// Newest-first fixture generator: item 0 is newest, matching how both
// buildEventTimelineItems and buildVersionHistoryTimelineItems order data.
function makeItems(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    action: 'פעולה',
    date: new Date(2026, 0, count - index),
    user: 'משתמש',
    summary: 'סיכום',
    tone: 'neutral',
  }));
}

describe('sliceTimelineForDisplay', () => {
  it('shows every item and reports no "more" when the list has exactly the limit', () => {
    const items = makeItems(DEFAULT_VISIBLE_HISTORY_COUNT);
    const { visibleItems, hasMore } = sliceTimelineForDisplay(items, false);
    expect(visibleItems).toHaveLength(DEFAULT_VISIBLE_HISTORY_COUNT);
    expect(hasMore).toBe(false);
  });

  it('shows every item and reports no "more" when the list has fewer than the limit', () => {
    const items = makeItems(10);
    const { visibleItems, hasMore } = sliceTimelineForDisplay(items, false);
    expect(visibleItems).toHaveLength(10);
    expect(hasMore).toBe(false);
  });

  it('shows only the first 25 (collapsed) when there are more than 25', () => {
    const items = makeItems(40);
    const { visibleItems, hasMore } = sliceTimelineForDisplay(items, false);
    expect(hasMore).toBe(true);
    expect(visibleItems).toHaveLength(DEFAULT_VISIBLE_HISTORY_COUNT);
    expect(visibleItems.map((i) => i.id)).toEqual(items.slice(0, 25).map((i) => i.id));
  });

  it('expanded=true reveals every currently loaded item', () => {
    const items = makeItems(40);
    const { visibleItems, hasMore } = sliceTimelineForDisplay(items, true);
    expect(hasMore).toBe(true); // toggle should still render so it can collapse again
    expect(visibleItems).toHaveLength(40);
    expect(visibleItems.map((i) => i.id)).toEqual(items.map((i) => i.id));
  });

  it('collapsing (expanded=false again) returns to the first 25', () => {
    const items = makeItems(40);
    const expandedResult = sliceTimelineForDisplay(items, true);
    expect(expandedResult.visibleItems).toHaveLength(40);

    const collapsedResult = sliceTimelineForDisplay(items, false);
    expect(collapsedResult.visibleItems).toHaveLength(25);
    expect(collapsedResult.visibleItems.map((i) => i.id)).toEqual(items.slice(0, 25).map((i) => i.id));
  });

  it('preserves newest-first ordering — never re-sorts', () => {
    const items = makeItems(40);
    const { visibleItems } = sliceTimelineForDisplay(items, false);
    const dates = visibleItems.map((i) => i.date.getTime());
    const sortedDesc = [...dates].sort((a, b) => b - a);
    expect(dates).toEqual(sortedDesc);
    expect(visibleItems[0].id).toBe('item-0'); // the newest fixture item
  });

  it('handles a non-array items input safely', () => {
    expect(sliceTimelineForDisplay(null, false)).toEqual({ visibleItems: [], hasMore: false });
    expect(sliceTimelineForDisplay(undefined, true)).toEqual({ visibleItems: [], hasMore: false });
  });
});

describe('the version-row fallback follows the same display limit', () => {
  function makeVersions(count) {
    return Array.from({ length: count }, (_, index) => ({
      id: `ver-${index}`,
      status: VERSION_STATUS.PUBLISHED,
      name: 'שם',
      createdAt: new Date(2026, 0, count - index),
      approvedAt: new Date(2026, 0, count - index),
      createdBy: { email: 'a@example.com' },
      approvedBy: { email: 'b@example.com' },
    }));
  }

  it('caps the fallback (no events, only version rows) at 25 when collapsed', () => {
    const versions = makeVersions(40);
    const fallbackItems = buildTalentHistoryTimelineItems([], new Map(), versions);
    expect(fallbackItems).toHaveLength(40); // nothing is dropped from the projection itself

    const { visibleItems, hasMore } = sliceTimelineForDisplay(fallbackItems, false);
    expect(hasMore).toBe(true);
    expect(visibleItems).toHaveLength(25);
  });

  it('expands the fallback to all currently loaded version rows', () => {
    const versions = makeVersions(40);
    const fallbackItems = buildTalentHistoryTimelineItems([], new Map(), versions);
    const { visibleItems } = sliceTimelineForDisplay(fallbackItems, true);
    expect(visibleItems).toHaveLength(40);
  });
});
