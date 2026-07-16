/*
 * talentRepository.createTalentWithInitialVersion — unit coverage (Sprint
 * 5B: Create Talent test completion).
 *
 * Locks the atomic create contract the Add New Talent flow relies on:
 *
 *   1. parent Talent + first TalentVersion are written inside ONE
 *      prisma.$transaction (a half-created talent can never be observed);
 *   2. parent initial values: provided slug, ACTIVE lifecycle, revision 1;
 *   3. the first version is a DRAFT whose slug snapshot mirrors the parent
 *      slug, attributed to createdById;
 *   4. Talent.currentPublishedVersionId is never initialized — only the
 *      normal publish flow (publishTalentVersion) may ever set it;
 *   5. optional business fields are forwarded when present and normalized
 *      consistently when absent (category/tags -> [], featured -> false,
 *      visibility -> VISIBLE);
 *   6. a failure while writing the version propagates out of the
 *      transaction, so the parent insert rolls back with it.
 *
 * Prisma is mocked (no test may touch a real database); $transaction just
 * invokes the callback with the same mocked tx object, which is exactly
 * how the real client behaves for interactive transactions — same pattern
 * as talentRepository.publishSlug.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const talentCreate = vi.fn(async ({ data }) => ({ id: 't-new', ...data }));
const versionCreate = vi.fn(async ({ data }) => ({ id: 'v-new', ...data }));

const tx = {
  talent: { create: talentCreate },
  talentVersion: { create: versionCreate },
};

const transaction = vi.fn(async (fn) => fn(tx));

vi.mock('@/lib/admin/db', () => ({
  prisma: {
    $transaction: (fn) => transaction(fn),
  },
  isDatabaseConfigured: true,
}));

import { talentRepository } from '@/lib/admin/repository/talentRepository';
import {
  LIFECYCLE_STATUS,
  VERSION_STATUS,
  TALENT_VISIBILITY,
} from '@/lib/admin/constants/enums';

const MINIMAL = Object.freeze({
  slug: 'new-talent',
  createdById: 'user-1',
  fields: Object.freeze({ name: 'ישראל ישראלי' }),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createTalentWithInitialVersion — atomicity', () => {
  it('creates the parent Talent and the initial TalentVersion inside a single transaction', async () => {
    await talentRepository.createTalentWithInitialVersion({ ...MINIMAL });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(talentCreate).toHaveBeenCalledTimes(1);
    expect(versionCreate).toHaveBeenCalledTimes(1);
  });

  it('propagates a version-write failure out of the transaction (parent insert rolls back with it)', async () => {
    versionCreate.mockRejectedValueOnce(new Error('version write failed'));

    await expect(
      talentRepository.createTalentWithInitialVersion({ ...MINIMAL })
    ).rejects.toThrow('version write failed');

    // Both writes were attempted inside the same (now failed) transaction —
    // with the real client that one rejection aborts the transaction, so no
    // parent row survives. No second transaction ever ran that could have
    // committed the parent alone.
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(talentCreate).toHaveBeenCalledTimes(1);
  });
});

describe('createTalentWithInitialVersion — initial values', () => {
  it('creates the parent with the provided slug, ACTIVE status, and revision 1', async () => {
    await talentRepository.createTalentWithInitialVersion({ ...MINIMAL });

    expect(talentCreate).toHaveBeenCalledWith({
      data: {
        slug: 'new-talent',
        status: LIFECYCLE_STATUS.ACTIVE,
        revisionNumber: 1,
      },
    });
  });

  it('creates the first version as a DRAFT, attributed to createdById, linked to the new parent', async () => {
    const { version } = await talentRepository.createTalentWithInitialVersion({ ...MINIMAL });

    const { data } = versionCreate.mock.calls[0][0];
    expect(data.talentId).toBe('t-new');
    expect(data.status).toBe(VERSION_STATUS.DRAFT);
    expect(data.createdById).toBe('user-1');
    expect(version.status).toBe(VERSION_STATUS.DRAFT);
  });

  it("the version's slug snapshot mirrors the parent slug when no versioned slug is provided", async () => {
    await talentRepository.createTalentWithInitialVersion({ ...MINIMAL });

    const { data } = versionCreate.mock.calls[0][0];
    expect(data.slug).toBe('new-talent');
  });

  it('never initializes the published-version pointer', async () => {
    const { talent } = await talentRepository.createTalentWithInitialVersion({ ...MINIMAL });

    // The parent insert doesn't set the pointer...
    const { data } = talentCreate.mock.calls[0][0];
    expect(data).not.toHaveProperty('currentPublishedVersionId');
    // ...and no other write in the transaction touches the parent (the tx
    // stub exposes no talent.update — any attempt would have thrown).
    expect(talent.currentPublishedVersionId).toBeUndefined();
  });
});

describe('createTalentWithInitialVersion — field forwarding', () => {
  it('forwards optional business fields when present', async () => {
    await talentRepository.createTalentWithInitialVersion({
      slug: 'new-talent',
      createdById: 'user-1',
      fields: {
        name: 'ישראל ישראלי',
        nameEn: 'Israel Israeli',
        bioHe: 'ביוגרפיה',
        profileImageAssetId: 'asset-1',
        category: ['acting'],
        tags: ['tag-1'],
        featured: true,
        visibility: TALENT_VISIBILITY.HIDDEN,
        slug: 'versioned-snapshot',
      },
    });

    const { data } = versionCreate.mock.calls[0][0];
    expect(data).toMatchObject({
      name: 'ישראל ישראלי',
      nameEn: 'Israel Israeli',
      bioHe: 'ביוגרפיה',
      profileImageAssetId: 'asset-1',
      category: ['acting'],
      tags: ['tag-1'],
      featured: true,
      visibility: TALENT_VISIBILITY.HIDDEN,
      slug: 'versioned-snapshot',
    });
  });

  it('normalizes absent optional fields consistently (arrays empty, featured false, visibility VISIBLE)', async () => {
    await talentRepository.createTalentWithInitialVersion({ ...MINIMAL });

    const { data } = versionCreate.mock.calls[0][0];
    expect(data.category).toEqual([]);
    expect(data.tags).toEqual([]);
    expect(data.featured).toBe(false);
    expect(data.visibility).toBe(TALENT_VISIBILITY.VISIBLE);
    expect(data.nameEn).toBeUndefined();
    expect(data.bioHe).toBeUndefined();
    expect(data.profileImageAssetId).toBeUndefined();
  });
});

describe('createTalentWithInitialVersion — argument guards', () => {
  it.each([
    ['slug', { ...MINIMAL, slug: '' }],
    ['createdById', { ...MINIMAL, createdById: '' }],
    ['fields', { ...MINIMAL, fields: null }],
  ])('rejects a missing %s before opening a transaction', async (_label, params) => {
    await expect(
      talentRepository.createTalentWithInitialVersion(params)
    ).rejects.toThrow();

    expect(transaction).not.toHaveBeenCalled();
  });
});
