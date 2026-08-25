/*
 * Talent Archive & Restore feature — repository-level coverage for
 * talentRepository.archiveTalent/restoreTalent. Prisma is mocked (no test
 * may touch a real database), same convention as
 * talentRepository.publishSlug.test.js. Proves these two primitives are
 * pure status-transition updates: exactly one `talent.update` call, only
 * status/deletedAt/deletedBy touched, no other table read or written —
 * i.e. no cascade to TalentVersion/TalentSocial/TalentGalleryImage, which
 * is how "preserve all history/media/socials/SEO" is guaranteed at this
 * layer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LIFECYCLE_STATUS } from '@/lib/admin/constants/enums';

// vi.mock() factories are hoisted above the whole file, including any
// top-level `const` — referencing a plain top-level const from inside one
// hits the TDZ ("Cannot access '...' before initialization"). vi.hoisted()
// is the established fix elsewhere in this codebase (e.g.
// app/api/admin/talent/route.test.js): it hoists the variable's own
// initialization together with the mock registration, so the factory below
// can safely close over it.
const hoisted = vi.hoisted(() => ({
  talentUpdate: vi.fn(async ({ where, data }) => ({ id: where.id, ...data })),
  // Talent Published Sort Order sprint — archive/restore now run inside a
  // transaction that also takes the ordering lock and reads the roster
  // (see applyPublishedOrderingForArchive/Restore). Defaults here keep
  // every existing test in this file a pure status-transition case: an
  // empty roster means "nothing to reorder", so `talentUpdate` remains the
  // only call these tests observe, with exactly the same payload as
  // before this sprint.
  executeRaw: vi.fn(async () => 1),
  talentFindMany: vi.fn(async () => []),
  talentFindUnique: vi.fn(async () => null),
  versionUpdate: vi.fn(async ({ where, data }) => ({ id: where.id, ...data })),
}));

vi.mock('@/lib/admin/db', () => ({
  prisma: {
    $transaction: async (fn) =>
      fn({
        $executeRaw: hoisted.executeRaw,
        talent: {
          update: hoisted.talentUpdate,
          findMany: hoisted.talentFindMany,
          findUnique: hoisted.talentFindUnique,
        },
        talentVersion: { update: hoisted.versionUpdate },
      }),
  },
  isDatabaseConfigured: true,
}));

import { talentRepository } from '@/lib/admin/repository/talentRepository';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('talentRepository.archiveTalent', () => {
  it('returns null and touches nothing when talentId is falsy', async () => {
    const result = await talentRepository.archiveTalent(null, 'owner-1');
    expect(result).toBeNull();
    expect(hoisted.talentUpdate).not.toHaveBeenCalled();
  });

  it('sets status ARCHIVED and stamps deletedAt/deletedBy, nothing else', async () => {
    const result = await talentRepository.archiveTalent('talent-1', 'owner-1');

    expect(hoisted.talentUpdate).toHaveBeenCalledTimes(1);
    const call = hoisted.talentUpdate.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'talent-1' });
    expect(call.data.status).toBe(LIFECYCLE_STATUS.ARCHIVED);
    expect(call.data.deletedBy).toBe('owner-1');
    expect(call.data.deletedAt).toBeInstanceOf(Date);
    expect(Object.keys(call.data).sort()).toEqual(['deletedAt', 'deletedBy', 'status']);
    expect(result.status).toBe(LIFECYCLE_STATUS.ARCHIVED);
  });

  it('stamps a null deletedBy when no actor id is given', async () => {
    await talentRepository.archiveTalent('talent-1', undefined);
    expect(hoisted.talentUpdate.mock.calls[0][0].data.deletedBy).toBeNull();
  });
});

describe('talentRepository.restoreTalent', () => {
  it('returns null and touches nothing when talentId is falsy', async () => {
    const result = await talentRepository.restoreTalent(null);
    expect(result).toBeNull();
    expect(hoisted.talentUpdate).not.toHaveBeenCalled();
  });

  it('sets status ACTIVE and clears deletedAt/deletedBy, nothing else', async () => {
    const result = await talentRepository.restoreTalent('talent-1');

    expect(hoisted.talentUpdate).toHaveBeenCalledTimes(1);
    const call = hoisted.talentUpdate.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'talent-1' });
    expect(call.data).toEqual({
      status: LIFECYCLE_STATUS.ACTIVE,
      deletedAt: null,
      deletedBy: null,
    });
    expect(result.status).toBe(LIFECYCLE_STATUS.ACTIVE);
  });
});
