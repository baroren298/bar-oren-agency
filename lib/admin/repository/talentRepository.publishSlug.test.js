/*
 * Talent SEO + Slug Management sprint — publish behavior for the versioned
 * slug. Locks the authoritative gates inside
 * talentRepository.publishTalentVersion's transaction:
 *
 *   1. a version proposing a NEW slug updates Talent.slug atomically with
 *      the publish (the ONLY moment the public URL ever changes);
 *   2. publishing is blocked (tagged SLUG_CONFLICT error, no writes) when
 *      another Talent already owns the proposed slug — duplicate detection;
 *   3. publishing is blocked (tagged SLUG_INVALID error) when the stored
 *      proposed slug fails the format contract — the server-side belt
 *      behind the editor's client-side validation;
 *   4. a version with slug=null (pre-migration rows / untouched drafts)
 *      or a slug equal to the parent's current one publishes exactly as
 *      before, never touching Talent.slug and never running the duplicate
 *      lookup.
 *
 * Prisma is mocked (no test may touch a real database); $transaction just
 * invokes the callback with the same mocked tx object, which is exactly
 * how the real client behaves for interactive transactions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SLUG_CONFLICT_ERROR_CODE,
  SLUG_INVALID_ERROR_CODE,
} from '@/lib/admin/constants/enums';

const versionFindUnique = vi.fn();
const versionUpdate = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));
const talentFindUnique = vi.fn();
const talentFindFirst = vi.fn();
const talentUpdate = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));

const tx = {
  talentVersion: { findUnique: versionFindUnique, update: versionUpdate },
  talent: { findUnique: talentFindUnique, findFirst: talentFindFirst, update: talentUpdate },
};

vi.mock('@/lib/admin/db', () => ({
  prisma: {
    $transaction: async (fn) => fn(tx),
  },
  isDatabaseConfigured: true,
}));

import { talentRepository } from '@/lib/admin/repository/talentRepository';

const TALENT = {
  id: 't-1',
  slug: 'old-slug',
  revisionNumber: 3,
  currentPublishedVersionId: 'v-published',
};

function mockVersion(overrides = {}) {
  versionFindUnique.mockResolvedValue({
    id: 'v-2',
    talentId: 't-1',
    status: 'PROPOSED',
    slug: null,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  talentFindUnique.mockResolvedValue({ ...TALENT });
  talentFindFirst.mockResolvedValue(null); // slug free by default
});

describe('publishTalentVersion — slug application', () => {
  it('applies a new, valid, free slug to the parent Talent in the same publish', async () => {
    mockVersion({ slug: 'new-slug' });

    await talentRepository.publishTalentVersion('v-2', {
      expectedRevisionNumber: 3,
      approvedById: 'owner-1',
    });

    // duplicate lookup ran, excluding this talent itself
    expect(talentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'new-slug', id: { not: 't-1' } } })
    );

    // parent update carries the new slug alongside the normal repoint+bump
    const talentUpdateArg = talentUpdate.mock.calls[0][0];
    expect(talentUpdateArg.where).toEqual({ id: 't-1' });
    expect(talentUpdateArg.data).toEqual({
      currentPublishedVersionId: 'v-2',
      revisionNumber: { increment: 1 },
      slug: 'new-slug',
    });
  });

  it('slug=null (no slug change proposed) publishes without touching Talent.slug', async () => {
    mockVersion({ slug: null });

    await talentRepository.publishTalentVersion('v-2', { approvedById: 'owner-1' });

    expect(talentFindFirst).not.toHaveBeenCalled();
    const { data } = talentUpdate.mock.calls[0][0];
    expect(data).not.toHaveProperty('slug');
  });

  it('slug equal to the current one publishes without a duplicate lookup or slug write', async () => {
    mockVersion({ slug: 'old-slug' });

    await talentRepository.publishTalentVersion('v-2', { approvedById: 'owner-1' });

    expect(talentFindFirst).not.toHaveBeenCalled();
    const { data } = talentUpdate.mock.calls[0][0];
    expect(data).not.toHaveProperty('slug');
  });
});

describe('publishTalentVersion — duplicate slug detection', () => {
  it('blocks the publish with SLUG_CONFLICT when another talent owns the slug', async () => {
    mockVersion({ slug: 'taken-slug' });
    talentFindFirst.mockResolvedValue({ id: 't-other', slug: 'taken-slug' });

    await expect(
      talentRepository.publishTalentVersion('v-2', { approvedById: 'owner-1' })
    ).rejects.toMatchObject({
      code: SLUG_CONFLICT_ERROR_CODE,
      slug: 'taken-slug',
      conflictingTalentId: 't-other',
    });

    // thrown before any write — the transaction would roll back regardless,
    // but nothing was even attempted
    expect(versionUpdate).not.toHaveBeenCalled();
    expect(talentUpdate).not.toHaveBeenCalled();
  });
});

describe('publishTalentVersion — slug format gate', () => {
  it.each(['Bad-Slug', 'has space', 'a--b', '-edge', 'שם-בעברית', 'under_score'])(
    'blocks the publish with SLUG_INVALID for stored slug %j',
    async (badSlug) => {
      mockVersion({ slug: badSlug });

      await expect(
        talentRepository.publishTalentVersion('v-2', { approvedById: 'owner-1' })
      ).rejects.toMatchObject({ code: SLUG_INVALID_ERROR_CODE, slug: badSlug });

      expect(versionUpdate).not.toHaveBeenCalled();
      expect(talentUpdate).not.toHaveBeenCalled();
    }
  );
});
