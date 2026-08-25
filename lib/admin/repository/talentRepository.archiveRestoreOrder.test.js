/*
 * Talent Published Sort Order sprint — archive/restore ordering coverage.
 *
 * Complements talentRepository.archiveRestore.test.js (which pins the
 * "pure status transition" contract for an EMPTY roster) with the actual
 * ordering behavior: archiving closes the vacated position, restoring
 * appends rather than reusing a stale historical position, and neither
 * ever touches revisionNumber or any unrelated field. Same mocking
 * convention as talentRepository.publishOrder.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const executeRaw = vi.fn(async () => 1);
const talentFindMany = vi.fn(async () => []);
const talentFindUnique = vi.fn(async () => null);
const talentUpdate = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));
const versionUpdate = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));

const tx = {
  $executeRaw: executeRaw,
  talent: { findMany: talentFindMany, findUnique: talentFindUnique, update: talentUpdate },
  talentVersion: { update: versionUpdate },
};

vi.mock('@/lib/admin/db', () => ({
  prisma: { $transaction: async (fn) => fn(tx) },
  isDatabaseConfigured: true,
}));

import { talentRepository } from '@/lib/admin/repository/talentRepository';

let callLog = [];

function trackCalls() {
  executeRaw.mockImplementation(async () => {
    callLog.push('$executeRaw');
    return 1;
  });
  talentFindMany.mockImplementation(async () => {
    callLog.push('talent.findMany');
    return talentFindMany.__rows || [];
  });
}

/** A canonical published roster, positions 1..n. */
function rosterRows(names) {
  return names.map((name, i) => ({
    id: `t-${name}`,
    currentPublishedVersionId: `v-${name}`,
    currentPublishedVersion: { sortOrder: i + 1 },
  }));
}

function shiftWrites() {
  return versionUpdate.mock.calls
    .map(([arg]) => arg)
    .filter((arg) => Object.keys(arg.data).length === 1 && 'sortOrder' in arg.data)
    .map((arg) => ({ versionId: arg.where.id, sortOrder: arg.data.sortOrder }));
}

beforeEach(() => {
  vi.clearAllMocks();
  callLog = [];
  trackCalls();
  talentFindUnique.mockResolvedValue(null);
});

describe('archiveTalent — ordering', () => {
  it('archiving the FIRST talent closes the gap, shifting everyone after it down by one', async () => {
    talentFindMany.__rows = rosterRows(['A', 'B', 'C', 'D']);

    await talentRepository.archiveTalent('t-A', 'owner-1');

    expect(shiftWrites()).toEqual([
      { versionId: 'v-B', sortOrder: 1 },
      { versionId: 'v-C', sortOrder: 2 },
      { versionId: 'v-D', sortOrder: 3 },
    ]);
  });

  it('archiving a MIDDLE talent shifts only the talents after it', async () => {
    talentFindMany.__rows = rosterRows(['A', 'B', 'C', 'D']);

    await talentRepository.archiveTalent('t-B', 'owner-1');

    expect(shiftWrites()).toEqual([
      { versionId: 'v-C', sortOrder: 2 },
      { versionId: 'v-D', sortOrder: 3 },
    ]);
  });

  it('archiving the LAST talent shifts nobody', async () => {
    talentFindMany.__rows = rosterRows(['A', 'B', 'C', 'D']);

    await talentRepository.archiveTalent('t-D', 'owner-1');

    expect(shiftWrites()).toEqual([]);
  });

  it('resulting roster has no duplicates and is contiguous 1..N', async () => {
    talentFindMany.__rows = rosterRows(['A', 'B', 'C', 'D', 'E']);

    await talentRepository.archiveTalent('t-C', 'owner-1');

    const positions = shiftWrites().map((w) => w.sortOrder);
    expect(new Set(positions).size).toBe(positions.length); // no duplicates
    expect(positions).toEqual([...positions].sort((a, b) => a - b)); // contiguous ascending
  });

  it('only writes TalentVersion.sortOrder for shifted talents — no Talent row, no other field', async () => {
    talentFindMany.__rows = rosterRows(['A', 'B', 'C']);

    await talentRepository.archiveTalent('t-A', 'owner-1');

    // The only Talent row written is the one being archived itself.
    expect(talentUpdate).toHaveBeenCalledTimes(1);
    expect(talentUpdate.mock.calls[0][0].where).toEqual({ id: 't-A' });
    // Every version write touches sortOrder only.
    for (const [arg] of versionUpdate.mock.calls) {
      expect(Object.keys(arg.data)).toEqual(['sortOrder']);
    }
  });

  it('does not bump revisionNumber on the archived talent or on shifted talents', async () => {
    talentFindMany.__rows = rosterRows(['A', 'B', 'C']);

    await talentRepository.archiveTalent('t-A', 'owner-1');

    expect(talentUpdate.mock.calls[0][0].data).not.toHaveProperty('revisionNumber');
    for (const [arg] of versionUpdate.mock.calls) {
      expect(arg.data).not.toHaveProperty('revisionNumber');
    }
  });

  it('takes the advisory lock before reading the roster', async () => {
    talentFindMany.__rows = rosterRows(['A', 'B']);

    await talentRepository.archiveTalent('t-A', 'owner-1');

    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(callLog.indexOf('$executeRaw')).toBeLessThan(callLog.indexOf('talent.findMany'));
  });

  it('a talent with no published version archives with no ordering writes', async () => {
    talentFindMany.__rows = rosterRows(['A', 'B']); // t-X not among them

    await talentRepository.archiveTalent('t-X', 'owner-1');

    expect(shiftWrites()).toEqual([]);
  });

  it('skips reordering against a non-normalized (0-based) roster, same as publish', async () => {
    talentFindMany.__rows = [
      { id: 't-A', currentPublishedVersionId: 'v-A', currentPublishedVersion: { sortOrder: 0 } },
      { id: 't-B', currentPublishedVersionId: 'v-B', currentPublishedVersion: { sortOrder: 1 } },
    ];

    await talentRepository.archiveTalent('t-A', 'owner-1');

    expect(shiftWrites()).toEqual([]);
    // The archive itself still happens — only ordering is skipped.
    expect(talentUpdate).toHaveBeenCalledTimes(1);
  });

  it('falsy talentId touches nothing, including no lock', async () => {
    const result = await talentRepository.archiveTalent(null, 'owner-1');
    expect(result).toBeNull();
    expect(executeRaw).not.toHaveBeenCalled();
    expect(talentUpdate).not.toHaveBeenCalled();
  });
});

describe('restoreTalent — ordering', () => {
  it('appends the restored talent to the end of the current roster', async () => {
    talentFindMany.__rows = rosterRows(['A', 'C', 'D']); // B already archived, gap closed
    talentFindUnique.mockResolvedValue({ currentPublishedVersionId: 'v-B' });

    await talentRepository.restoreTalent('t-B');

    expect(shiftWrites()).toEqual([{ versionId: 'v-B', sortOrder: 4 }]);
  });

  it('overwrites a stale historical sortOrder rather than reusing it', async () => {
    // B's stale value (2) would collide with C's live position.
    talentFindMany.__rows = rosterRows(['A', 'C', 'D']);
    talentFindUnique.mockResolvedValue({ currentPublishedVersionId: 'v-B' });

    await talentRepository.restoreTalent('t-B');

    const write = shiftWrites().find((w) => w.versionId === 'v-B');
    expect(write.sortOrder).toBe(4); // not the stale 2
    // No other talent's position changes as a side effect of the stale value.
    expect(shiftWrites()).toHaveLength(1);
  });

  it('restoring a talent with no currentPublishedVersion does no ordering work', async () => {
    talentFindMany.__rows = rosterRows(['A', 'C', 'D']);
    talentFindUnique.mockResolvedValue({ currentPublishedVersionId: null });

    await talentRepository.restoreTalent('t-X');

    expect(shiftWrites()).toEqual([]);
    // The roster is never even read — nothing to order.
    expect(talentFindMany).not.toHaveBeenCalled();
  });

  it('resulting roster is contiguous 1..N with no duplicates', async () => {
    talentFindMany.__rows = rosterRows(['A', 'C', 'D', 'E']);
    talentFindUnique.mockResolvedValue({ currentPublishedVersionId: 'v-B' });

    await talentRepository.restoreTalent('t-B');

    const write = shiftWrites().find((w) => w.versionId === 'v-B');
    expect(write.sortOrder).toBe(5); // one past the current end
  });

  it('does not bump revisionNumber for the restore or the ordering write', async () => {
    talentFindMany.__rows = rosterRows(['A']);
    talentFindUnique.mockResolvedValue({ currentPublishedVersionId: 'v-B' });

    await talentRepository.restoreTalent('t-B');

    expect(talentUpdate.mock.calls[0][0].data).not.toHaveProperty('revisionNumber');
    for (const [arg] of versionUpdate.mock.calls) {
      expect(arg.data).not.toHaveProperty('revisionNumber');
    }
  });

  it('takes the advisory lock before reading anything', async () => {
    talentFindMany.__rows = rosterRows(['A']);
    talentFindUnique.mockResolvedValue({ currentPublishedVersionId: 'v-B' });

    await talentRepository.restoreTalent('t-B');

    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(callLog.indexOf('$executeRaw')).toBeLessThan(callLog.indexOf('talent.findMany'));
  });

  it('skips reordering against a non-normalized roster', async () => {
    talentFindMany.__rows = [
      { id: 't-A', currentPublishedVersionId: 'v-A', currentPublishedVersion: { sortOrder: 0 } },
    ];
    talentFindUnique.mockResolvedValue({ currentPublishedVersionId: 'v-B' });

    await talentRepository.restoreTalent('t-B');

    expect(shiftWrites()).toEqual([]);
    expect(talentUpdate).toHaveBeenCalledTimes(1); // the restore itself still happens
  });

  it('falsy talentId touches nothing, including no lock', async () => {
    const result = await talentRepository.restoreTalent(null);
    expect(result).toBeNull();
    expect(executeRaw).not.toHaveBeenCalled();
    expect(talentUpdate).not.toHaveBeenCalled();
  });
});
