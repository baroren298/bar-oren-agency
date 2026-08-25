/*
 * Talent Published Sort Order sprint — the ordering contract.
 *
 * Every case in the approved product spec is pinned here, against the pure
 * primitive rather than the database, because the primitive is where all the
 * decisions actually live: talentRepository.publishTalentVersion only reads
 * the roster, calls these functions and writes the diff. No mocks, no I/O —
 * same style as lib/admin/gallery-images.test.js and slug.test.js.
 *
 * The regression that motivated the sprint: Lihi and Shilav could both hold
 * sortOrder = 7, because nothing on the publish path ever looked at the
 * value. `publishes into an occupied position` below is the case that would
 * have caught it.
 */

import { describe, it, expect } from 'vitest';
import {
  PUBLISHED_ORDER_BASE,
  POSITION_REASON,
  isCanonicalPublishedOrder,
  resolvePublishPosition,
  computePublishedOrder,
  computeOrderAfterRemoval,
} from './published-order';

/** A canonical roster: names in order, positions 1..n. */
function roster(names) {
  return names.map((name, i) => ({
    talentId: name,
    versionId: `v-${name}`,
    sortOrder: i + PUBLISHED_ORDER_BASE,
  }));
}

/** "1=a, 2=b, ..." — reads like the spec's own before/after tables. */
function render(order) {
  return order.map((entry) => `${entry.sortOrder}=${entry.talentId}`).join(', ');
}

/**
 * The full publish-time decision, exactly as talentRepository composes it:
 * resolve the requested position against the roster, then splice.
 */
function publish(names, movingTalentId, requestedSortOrder, { basedOnSortOrder = null } = {}) {
  const currentOrder = roster(names);
  const self = currentOrder.find((entry) => entry.talentId === movingTalentId) || null;
  const targetLength = self ? currentOrder.length : currentOrder.length + 1;

  const resolved = resolvePublishPosition({
    requestedSortOrder,
    currentPosition: self ? self.sortOrder : null,
    basedOnSortOrder,
    targetLength,
  });

  return {
    resolved,
    ...computePublishedOrder({
      currentOrder,
      movingTalentId,
      movingVersionId: `v-new-${movingTalentId}`,
      position: resolved.position,
    }),
  };
}

describe('isCanonicalPublishedOrder — the normalization gate', () => {
  it('accepts an empty roster (publishing the very first talent)', () => {
    expect(isCanonicalPublishedOrder([])).toBe(true);
  });

  it('accepts a contiguous 1..N roster', () => {
    expect(isCanonicalPublishedOrder(roster(['a', 'b', 'c']))).toBe(true);
  });

  it('rejects the 0-based seeded production data', () => {
    // data/talent/index.js ships sortOrder 0..9. This is the case that keeps
    // an ordinary publish from silently renumbering the whole roster.
    expect(isCanonicalPublishedOrder([{ sortOrder: 0 }, { sortOrder: 1 }, { sortOrder: 2 }])).toBe(
      false
    );
  });

  it('rejects duplicates, nulls, gaps and non-integers', () => {
    expect(isCanonicalPublishedOrder([{ sortOrder: 1 }, { sortOrder: 2 }, { sortOrder: 2 }])).toBe(false);
    expect(isCanonicalPublishedOrder([{ sortOrder: 1 }, { sortOrder: null }])).toBe(false);
    expect(isCanonicalPublishedOrder([{ sortOrder: 1 }, { sortOrder: 3 }])).toBe(false);
    expect(isCanonicalPublishedOrder([{ sortOrder: 1.5 }])).toBe(false);
  });
});

describe('new Talent publication', () => {
  it('publishes into an occupied position, shifting that talent and everyone after (+1)', () => {
    // The exact spec scenario: A=6, Shilav=7, B=8, C=9; publish Lihi at 7.
    const { order } = publish(
      ['T1', 'T2', 'T3', 'T4', 'T5', 'A', 'Shilav', 'B', 'C'],
      'Lihi',
      7
    );

    expect(render(order)).toBe(
      '1=T1, 2=T2, 3=T3, 4=T4, 5=T5, 6=A, 7=Lihi, 8=Shilav, 9=B, 10=C'
    );
  });

  it('inserts at the beginning', () => {
    expect(render(publish(['a', 'b', 'c'], 'New', 1).order)).toBe('1=New, 2=a, 3=b, 4=c');
  });

  it('appends when the requested position is past the end of the list', () => {
    const { order, resolved } = publish(['a', 'b', 'c'], 'New', 999);
    expect(resolved.position).toBe(4);
    expect(resolved.clamped).toBe(true);
    expect(render(order)).toBe('1=a, 2=b, 3=c, 4=New');
  });

  it('lands the very first published talent at position 1, not 0', () => {
    const { order, resolved } = publish([], 'Only', null);
    expect(resolved.position).toBe(1);
    expect(render(order)).toBe('1=Only');
  });
});

describe('existing Talent movement', () => {
  it('moves upward (12 -> 7), shifting the affected band down by one', () => {
    const { order } = publish(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'H'],
      'H',
      7
    );

    expect(render(order)).toBe(
      '1=a, 2=b, 3=c, 4=d, 5=e, 6=f, 7=H, 8=g, 9=h, 10=i, 11=j, 12=k'
    );
  });

  it('moves downward (7 -> 12), closing the gap it left behind', () => {
    const { order } = publish(
      ['a', 'b', 'c', 'd', 'e', 'f', 'X', 'h', 'i', 'j', 'k', 'l'],
      'X',
      12
    );

    expect(render(order)).toBe(
      '1=a, 2=b, 3=c, 4=d, 5=e, 6=f, 7=h, 8=i, 9=j, 10=k, 11=l, 12=X'
    );
  });

  it('publishes at the same position without reordering anything else', () => {
    const { order, changes, resolved } = publish(['a', 'b', 'X', 'd'], 'X', 3, {
      basedOnSortOrder: 3,
    });

    expect(resolved.reason).toBe(POSITION_REASON.UNCHANGED);
    expect(render(order)).toBe('1=a, 2=b, 3=X, 4=d');
    // Only the version being published is written — no unrelated talent moves.
    expect(changes.map((c) => c.talentId)).toEqual(['X']);
    // ...and it is the NEW version row that receives the position.
    expect(changes[0].versionId).toBe('v-new-X');
  });

  it('touches only the affected band, never the whole roster', () => {
    const { changes } = publish(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
      'New',
      8
    );

    expect(changes.map((c) => c.talentId)).toEqual(['New', 'h', 'i', 'j']);
  });
});

describe('anti-drift — a Draft that never touched the position field', () => {
  it('keeps the talent where it is now, not where the Draft was seeded from', () => {
    // The draft was seeded when X sat at 3. Somebody else has since published
    // and pushed X to 4. Publishing this untouched draft must not drag X back.
    const resolved = resolvePublishPosition({
      requestedSortOrder: 3,
      currentPosition: 4,
      basedOnSortOrder: 3,
      targetLength: 4,
    });

    expect(resolved.position).toBe(4);
    expect(resolved.reason).toBe(POSITION_REASON.UNCHANGED);

    const { order } = computePublishedOrder({
      currentOrder: roster(['a', 'b', 'c', 'X']),
      movingTalentId: 'X',
      movingVersionId: 'v-new',
      position: resolved.position,
    });
    expect(render(order)).toBe('1=a, 2=b, 3=c, 4=X');
  });

  it('still honors a real move to a different number than the base', () => {
    const { order, resolved } = publish(['a', 'b', 'c', 'X'], 'X', 2, { basedOnSortOrder: 4 });
    expect(resolved.reason).toBe(POSITION_REASON.EXPLICIT);
    expect(render(order)).toBe('1=a, 2=X, 3=b, 4=c');
  });
});

describe('null / unset sortOrder', () => {
  it('first publish with no position appends to the end', () => {
    const { order, resolved } = publish(['a', 'b', 'c'], 'New', null);
    expect(resolved.reason).toBe(POSITION_REASON.APPEND_UNSET);
    expect(render(order)).toBe('1=a, 2=b, 3=c, 4=New');
  });

  it('an existing published talent that clears its position moves to the end', () => {
    const { order, resolved } = publish(['a', 'b', 'X', 'd'], 'X', null);
    expect(resolved.reason).toBe(POSITION_REASON.APPEND_UNSET);
    expect(render(order)).toBe('1=a, 2=b, 3=d, 4=X');
  });

  it('treats an unparseable number (NaN from the admin input) as unset', () => {
    const resolved = resolvePublishPosition({
      requestedSortOrder: Number.NaN,
      currentPosition: null,
      basedOnSortOrder: null,
      targetLength: 5,
    });
    expect(resolved.reason).toBe(POSITION_REASON.APPEND_UNSET);
    expect(resolved.position).toBe(5);
  });

  it('always leaves the published talent with a concrete position, never null', () => {
    const { order } = publish(['a', 'b'], 'New', null);
    expect(order.every((entry) => Number.isInteger(entry.sortOrder))).toBe(true);
  });
});

describe('bounds', () => {
  it('clamps a position below the first slot up to 1', () => {
    const { resolved } = publish(['a', 'b', 'c'], 'X', 0);
    expect(resolved.position).toBe(PUBLISHED_ORDER_BASE);
    expect(resolved.clamped).toBe(true);
  });

  it('does not flag an in-range position as clamped', () => {
    expect(publish(['a', 'b', 'c'], 'X', 2).resolved.clamped).toBe(false);
  });
});

describe('the invariant', () => {
  it('never produces a duplicate or a gap, for any roster size and any requested position', () => {
    const offenders = [];

    for (let n = 0; n <= 12; n += 1) {
      const names = Array.from({ length: n }, (_, i) => `n${i}`);

      for (let position = -2; position <= n + 3; position += 1) {
        for (const mover of [...names, 'FRESH']) {
          const { order } = publish(names, mover, position);
          const values = order.map((entry) => entry.sortOrder);
          const expectedLength = names.includes(mover) ? n : n + 1;

          const ok =
            values.length === expectedLength &&
            new Set(values).size === values.length &&
            values.every((value, i) => value === i + PUBLISHED_ORDER_BASE) &&
            new Set(order.map((entry) => entry.talentId)).size === expectedLength;

          if (!ok) offenders.push({ n, position, mover, values });
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});


describe('computeOrderAfterRemoval — archive closes the gap', () => {
  it('archiving the first talent shifts everyone else down by one', () => {
    const { order } = computeOrderAfterRemoval({
      currentOrder: roster(['A', 'B', 'C', 'D']),
      removingTalentId: 'A',
    });
    expect(render(order)).toBe('1=B, 2=C, 3=D');
  });

  it('archiving a middle talent shifts only the talents after it', () => {
    const { order, changes } = computeOrderAfterRemoval({
      currentOrder: roster(['A', 'B', 'C', 'D']),
      removingTalentId: 'B',
    });
    expect(render(order)).toBe('1=A, 2=C, 3=D');
    expect(changes.map((c) => c.talentId)).toEqual(['C', 'D']);
  });

  it('archiving the last talent shifts nobody', () => {
    const { order, changes } = computeOrderAfterRemoval({
      currentOrder: roster(['A', 'B', 'C', 'D']),
      removingTalentId: 'D',
    });
    expect(render(order)).toBe('1=A, 2=B, 3=C');
    expect(changes).toEqual([]);
  });

  it('never produces a duplicate or a gap for any removal, any roster size', () => {
    const offenders = [];
    for (let n = 1; n <= 10; n += 1) {
      const names = Array.from({ length: n }, (_, i) => `n${i}`);
      for (const removed of names) {
        const { order } = computeOrderAfterRemoval({ currentOrder: roster(names), removingTalentId: removed });
        const values = order.map((e) => e.sortOrder);
        const ok =
          values.length === n - 1 &&
          new Set(values).size === values.length &&
          values.every((v, i) => v === i + PUBLISHED_ORDER_BASE);
        if (!ok) offenders.push({ n, removed, values });
      }
    }
    expect(offenders).toEqual([]);
  });
});
