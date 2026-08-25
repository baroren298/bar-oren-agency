/*
 * Talent Published Sort Order sprint — publish-time automatic reordering,
 * at the repository boundary.
 *
 * The pure ordering contract (which position wins, how the list splices) is
 * covered exhaustively in lib/admin/published-order.test.js. What this file
 * locks down is the part that only exists here: that the reorder happens at
 * the canonical Publish transition and NOWHERE else, that it takes its lock
 * before it reads, that it leaves revisionNumber alone for talents it merely
 * shifted, and that it declines to run at all against a roster that has not
 * been normalized yet.
 *
 * The regression that motivated the sprint: two published talents could both
 * hold sortOrder = 7, because publishTalentVersion never read the column.
 * `shifts the occupant and everyone after it` is the test that would have
 * caught that.
 *
 * Prisma is mocked (no test may touch a real database); $transaction just
 * invokes the callback with the same mocked tx object, which is exactly how
 * the real client behaves for interactive transactions — same pattern as
 * talentRepository.publishSlug.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SLUG_CONFLICT_ERROR_CODE } from '@/lib/admin/constants/enums';

/** Every tx call, in order — so "the lock came first" is assertable. */
let callLog = [];

const executeRaw = vi.fn((...args) => {
  callLog.push('$executeRaw');
  return 1;
});
const versionFindUnique = vi.fn(() => null);
const versionUpdate = vi.fn(async ({ where, data }) => {
  callLog.push('talentVersion.update');
  return { id: where.id, ...data };
});
const talentFindUnique = vi.fn();
const talentFindFirst = vi.fn(async () => null);
const talentFindMany = vi.fn(async () => {
  callLog.push('talent.findMany');
  return [];
});
const talentUpdate = vi.fn(async ({ where, data }) => {
  callLog.push('talent.update');
  return { id: where.id, ...data };
});

const tx = {
  $executeRaw: executeRaw,
  talentVersion: { findUnique: versionFindUnique, update: versionUpdate },
  talent: {
    findUnique: talentFindUnique,
    findFirst: talentFindFirst,
    findMany: talentFindMany,
    update: talentUpdate,
  },
};

const topLevelVersionUpdate = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));

vi.mock('@/lib/admin/db', () => ({
  prisma: {
    $transaction: async (fn) => fn(tx),
    talentVersion: {
      update: (...args) => topLevelVersionUpdate(...args),
      findUnique: async () => null,
    },
  },
  isDatabaseConfigured: true,
}));

import { talentRepository } from '@/lib/admin/repository/talentRepository';

const PUBLISHING_TALENT = {
  id: 't-new',
  slug: 'lihi-levi',
  revisionNumber: 1,
  currentPublishedVersionId: null,
};

/**
 * A published roster in canonical 1..N order. Shaped exactly like the
 * `talent.findMany` select in applyPublishedOrdering.
 */
function rosterRows(names) {
  return names.map((name, i) => ({
    id: `t-${name}`,
    currentPublishedVersionId: `v-${name}`,
    currentPublishedVersion: { sortOrder: i + 1 },
  }));
}

/** Which other talents' version rows got a new sortOrder, and what it is. */
function shiftWrites() {
  return versionUpdate.mock.calls
    .map(([arg]) => arg)
    .filter((arg) => Object.keys(arg.data).length === 1 && 'sortOrder' in arg.data)
    .map((arg) => ({ versionId: arg.where.id, sortOrder: arg.data.sortOrder }));
}

/** The single update that flips the target version to PUBLISHED. */
function publishWrite() {
  return versionUpdate.mock.calls.map(([arg]) => arg).find((arg) => 'status' in arg.data);
}

function mockPublishingVersion(overrides = {}) {
  versionFindUnique.mockImplementation(async ({ where }) => {
    if (where.id === 'v-draft') {
      return {
        id: 'v-draft',
        talentId: 't-new',
        status: 'PROPOSED',
        slug: null,
        sortOrder: null,
        basedOnVersionId: null,
        ...overrides,
      };
    }
    // basedOnVersion lookups
    return { id: where.id, sortOrder: overrides.basedOnSortOrder ?? null };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  callLog = [];
  talentFindUnique.mockResolvedValue({ ...PUBLISHING_TALENT });
  talentFindFirst.mockResolvedValue(null);
  talentFindMany.mockImplementation(async () => {
    callLog.push('talent.findMany');
    return [];
  });
});

describe('publishTalentVersion — automatic reordering', () => {
  it('shifts the occupant and everyone after it when publishing into a taken position', async () => {
    // Roster: a=1, b=2, c=3, d=4. Publish a brand-new talent at 2.
    talentFindMany.mockImplementation(async () => {
      callLog.push('talent.findMany');
      return rosterRows(['a', 'b', 'c', 'd']);
    });
    mockPublishingVersion({ sortOrder: 2 });

    const result = await talentRepository.publishTalentVersion('v-draft', {
      approvedById: 'owner-1',
    });

    // b, c, d each move down exactly one. `a` is before the insertion point
    // and is never written.
    expect(shiftWrites()).toEqual([
      { versionId: 'v-b', sortOrder: 3 },
      { versionId: 'v-c', sortOrder: 4 },
      { versionId: 'v-d', sortOrder: 5 },
    ]);

    // ...and the newly published version takes the requested slot.
    expect(publishWrite().data.sortOrder).toBe(2);
    expect(result.ordering).toMatchObject({ applied: true, position: 2, shifted: 3 });
  });

  it('does NOT bump revisionNumber for talents it merely shifted', async () => {
    // Bumping them would turn every open Draft on those talents into a
    // spurious REVISION_CONFLICT.
    talentFindMany.mockImplementation(async () => rosterRows(['a', 'b', 'c']));
    mockPublishingVersion({ sortOrder: 1 });

    await talentRepository.publishTalentVersion('v-draft', { approvedById: 'owner-1' });

    // Exactly one Talent row is updated: the one being published.
    expect(talentUpdate).toHaveBeenCalledTimes(1);
    expect(talentUpdate.mock.calls[0][0].where).toEqual({ id: 't-new' });
    expect(talentUpdate.mock.calls[0][0].data).toMatchObject({
      revisionNumber: { increment: 1 },
    });
  });

  it('appends a talent published with no position, never leaving it null', async () => {
    talentFindMany.mockImplementation(async () => rosterRows(['a', 'b', 'c']));
    mockPublishingVersion({ sortOrder: null });

    const result = await talentRepository.publishTalentVersion('v-draft', {
      approvedById: 'owner-1',
    });

    expect(shiftWrites()).toEqual([]); // nobody else moves
    expect(publishWrite().data.sortOrder).toBe(4);
    expect(result.ordering).toMatchObject({ applied: true, reason: 'APPEND_UNSET', position: 4 });
  });

  it('reorders nothing when an already-published talent republishes in place', async () => {
    // t-b is already published at 2; its draft carries the same 2 it was
    // seeded with, and the base version agrees. Ordinary Details edits.
    talentFindUnique.mockResolvedValue({
      id: 't-b',
      slug: 'b',
      revisionNumber: 4,
      currentPublishedVersionId: 'v-b',
    });
    talentFindMany.mockImplementation(async () => rosterRows(['a', 'b', 'c']));
    versionFindUnique.mockImplementation(async ({ where }) => {
      if (where.id === 'v-draft') {
        return {
          id: 'v-draft',
          talentId: 't-b',
          status: 'PROPOSED',
          slug: null,
          sortOrder: 2,
          basedOnVersionId: 'v-b',
        };
      }
      return { id: where.id, sortOrder: 2 };
    });

    const result = await talentRepository.publishTalentVersion('v-draft', {
      approvedById: 'owner-1',
    });

    expect(shiftWrites()).toEqual([]);
    expect(result.ordering).toMatchObject({ applied: true, reason: 'UNCHANGED', position: 2 });
  });
});

describe('publishTalentVersion — concurrency guard', () => {
  it('takes the advisory lock before reading the roster', async () => {
    talentFindMany.mockImplementation(async () => {
      callLog.push('talent.findMany');
      return rosterRows(['a', 'b']);
    });
    mockPublishingVersion({ sortOrder: 1 });

    await talentRepository.publishTalentVersion('v-draft', { approvedById: 'owner-1' });

    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(callLog.indexOf('$executeRaw')).toBeLessThan(callLog.indexOf('talent.findMany'));
  });
});

describe('publishTalentVersion — the normalization gate', () => {
  it('skips reordering entirely against the 0-based seeded roster', async () => {
    // data/talent/index.js ships sortOrder 0..N-1. Publishing must keep
    // working exactly as it did before this sprint, and must NOT quietly
    // renumber the whole roster as a side effect.
    talentFindMany.mockImplementation(async () => [
      { id: 't-a', currentPublishedVersionId: 'v-a', currentPublishedVersion: { sortOrder: 0 } },
      { id: 't-b', currentPublishedVersionId: 'v-b', currentPublishedVersion: { sortOrder: 1 } },
    ]);
    mockPublishingVersion({ sortOrder: 1 });

    const result = await talentRepository.publishTalentVersion('v-draft', {
      approvedById: 'owner-1',
    });

    expect(shiftWrites()).toEqual([]);
    expect(publishWrite().data).not.toHaveProperty('sortOrder');
    expect(result.ordering).toMatchObject({ applied: false, reason: 'NOT_NORMALIZED' });
  });

  it('skips reordering when the roster already contains a duplicate position', async () => {
    talentFindMany.mockImplementation(async () => [
      { id: 't-a', currentPublishedVersionId: 'v-a', currentPublishedVersion: { sortOrder: 1 } },
      { id: 't-b', currentPublishedVersionId: 'v-b', currentPublishedVersion: { sortOrder: 1 } },
    ]);
    mockPublishingVersion({ sortOrder: 2 });

    const result = await talentRepository.publishTalentVersion('v-draft', {
      approvedById: 'owner-1',
    });

    expect(shiftWrites()).toEqual([]);
    expect(result.ordering).toMatchObject({ applied: false });
  });
});

describe('publishTalentVersion — failure semantics', () => {
  it('writes no ordering at all when the publish is blocked by a slug conflict', async () => {
    talentFindMany.mockImplementation(async () => rosterRows(['a', 'b', 'c']));
    mockPublishingVersion({ sortOrder: 1, slug: 'taken-slug' });
    talentFindFirst.mockResolvedValue({ id: 't-other', slug: 'taken-slug' });

    await expect(
      talentRepository.publishTalentVersion('v-draft', { approvedById: 'owner-1' })
    ).rejects.toMatchObject({ code: SLUG_CONFLICT_ERROR_CODE });

    // The gate throws before the lock is even taken; the transaction would
    // roll back regardless, but nothing was attempted.
    expect(executeRaw).not.toHaveBeenCalled();
    expect(versionUpdate).not.toHaveBeenCalled();
    expect(talentUpdate).not.toHaveBeenCalled();
  });
});

describe('Draft isolation — no other transition may reorder', () => {
  it('Save Draft writes only the draft row', async () => {
    await talentRepository.updateTalentVersionFields('v-draft', { sortOrder: 7, name: 'Lihi' });

    expect(topLevelVersionUpdate).toHaveBeenCalledTimes(1);
    expect(topLevelVersionUpdate.mock.calls[0][0].where).toEqual({ id: 'v-draft' });
    // Nothing inside a transaction ran at all — no lock, no roster read.
    expect(executeRaw).not.toHaveBeenCalled();
    expect(talentFindMany).not.toHaveBeenCalled();
    expect(versionUpdate).not.toHaveBeenCalled();
  });

  it('Submit (DRAFT -> PROPOSED) writes only the draft row', async () => {
    await talentRepository.updateTalentVersionStatus('v-draft', 'PROPOSED');

    expect(topLevelVersionUpdate).toHaveBeenCalledTimes(1);
    expect(topLevelVersionUpdate.mock.calls[0][0].data).toEqual({ status: 'PROPOSED' });
    expect(executeRaw).not.toHaveBeenCalled();
    expect(talentFindMany).not.toHaveBeenCalled();
  });
});
