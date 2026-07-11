/*
 * Podcast Image Upload sprint — locks the one allowlist change this sprint
 * makes to talentRepository.updateTalentVersionFields: podcastImageAssetId
 * is now writable, and nothing else got widened alongside it. Prisma is
 * mocked (same "no test may touch a real database/network" rule as every
 * other suite here); the assertions are about the exact `data` object the
 * repository hands Prisma, which is where the column-clobber allowlist
 * actually lives.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const update = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));
const findUnique = vi.fn(async ({ where }) => ({ id: where.id }));

vi.mock('@/lib/admin/db', () => ({
  prisma: {
    talentVersion: {
      update: (...args) => update(...args),
      findUnique: (...args) => findUnique(...args),
    },
  },
  isDatabaseConfigured: true,
}));

import { talentRepository } from '@/lib/admin/repository/talentRepository';

beforeEach(() => {
  update.mockClear();
  findUnique.mockClear();
});

describe('updateTalentVersionFields — podcastImageAssetId allowlist', () => {
  it('accepts podcastImageAssetId and writes exactly that column', async () => {
    await talentRepository.updateTalentVersionFields('v-1', { podcastImageAssetId: 'asset-9' });

    expect(update).toHaveBeenCalledOnce();
    const { where, data } = update.mock.calls[0][0];
    expect(where).toEqual({ id: 'v-1' });
    expect(data).toEqual({ podcastImageAssetId: 'asset-9' });
  });

  it('accepts an explicit null (clearing the image is a deliberate write, not an omission)', async () => {
    await talentRepository.updateTalentVersionFields('v-1', { podcastImageAssetId: null });

    const { data } = update.mock.calls[0][0];
    expect(data).toEqual({ podcastImageAssetId: null });
  });

  it('still drops non-allowlisted keys — the allowlist was not widened beyond this column', async () => {
    await talentRepository.updateTalentVersionFields('v-1', {
      podcastImageAssetId: 'asset-9',
      status: 'PUBLISHED', // lifecycle column — never writable here
      talentId: 't-2', // relation column — never writable here
      approvedById: 'u-1', // approval column — never writable here
      bogusColumn: 'x',
    });

    const { data } = update.mock.calls[0][0];
    expect(data).toEqual({ podcastImageAssetId: 'asset-9' });
  });

  it('a payload with only non-allowlisted keys writes nothing at all', async () => {
    await talentRepository.updateTalentVersionFields('v-1', { status: 'PUBLISHED' });

    expect(update).not.toHaveBeenCalled();
    expect(findUnique).toHaveBeenCalledOnce();
  });
});
