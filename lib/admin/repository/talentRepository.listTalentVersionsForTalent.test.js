/*
 * talentRepository.listTalentVersionsForTalent — Talent Details Lifecycle
 * Unification sprint (Gap 1 fix).
 *
 * Locks the exact defect this sprint fixes: the pending DRAFT/PROPOSED
 * version the admin Details tab reads comes from this list query
 * (versionService.getCurrentDraftOrProposed -> listVersionsForParent ->
 * this method), and until this fix its `include` carried
 * `podcastImageAsset` but not `profileImageAsset` — so a Draft's own
 * profile image (including one set at Talent creation, before any
 * Published version exists) never resolved a blobUrl. Prisma is mocked
 * (no test may touch a real database); the assertion is on the exact
 * `include` object the repository hands Prisma, same pattern
 * talentRepository.updateTalentVersionFields.test.js already uses for its
 * own allowlist.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn(async () => []);

vi.mock('@/lib/admin/db', () => ({
  prisma: {
    talentVersion: {
      findMany: (...args) => findMany(...args),
    },
  },
  isDatabaseConfigured: true,
}));

import { talentRepository } from '@/lib/admin/repository/talentRepository';

beforeEach(() => {
  findMany.mockClear();
});

describe('listTalentVersionsForTalent — profile/podcast image includes', () => {
  it('includes profileImageAsset (blobUrl only) — the Gap 1 fix', async () => {
    await talentRepository.listTalentVersionsForTalent('t-1');

    expect(findMany).toHaveBeenCalledOnce();
    const { include } = findMany.mock.calls[0][0];
    expect(include.profileImageAsset).toEqual({ select: { blobUrl: true } });
  });

  it('still includes podcastImageAsset (blobUrl only) — unchanged by this fix', async () => {
    await talentRepository.listTalentVersionsForTalent('t-1');

    const { include } = findMany.mock.calls[0][0];
    expect(include.podcastImageAsset).toEqual({ select: { blobUrl: true } });
  });

  it('still includes createdBy/approvedBy email-only projections — unchanged by this fix', async () => {
    await talentRepository.listTalentVersionsForTalent('t-1');

    const { include } = findMany.mock.calls[0][0];
    expect(include.createdBy).toEqual({ select: { email: true } });
    expect(include.approvedBy).toEqual({ select: { email: true } });
  });

  it('filters by talentId and orders newest first — unchanged by this fix', async () => {
    await talentRepository.listTalentVersionsForTalent('t-1');

    const { where, orderBy } = findMany.mock.calls[0][0];
    expect(where).toEqual({ talentId: 't-1' });
    expect(orderBy).toEqual({ createdAt: 'desc' });
  });
});
