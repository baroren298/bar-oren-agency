/*
 * Talent SEO + Slug Management sprint — SEO draft persistence. Locks the
 * exact allowlist change made to talentRepository.updateTalentVersionFields
 * (the column-clobber safeguard every Save Draft goes through): slug + the
 * seven SEO columns are writable, nothing else got widened, and a partial
 * SEO save never clobbers columns the payload didn't include. Same
 * Prisma-mocking pattern as talentRepository.updateTalentVersionFields.test.js.
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

describe('updateTalentVersionFields — slug + SEO allowlist', () => {
  it('persists the full SEO payload the SEO editor sends', async () => {
    const fields = {
      slug: 'noa-kirel',
      seoTitle: 'נועה קירל — זמרת',
      seoDescription: 'תיאור לתוצאות חיפוש',
      seoCanonicalUrl: 'https://baroren.co.il/talent/noa-kirel',
      seoOgTitle: 'כותרת לשיתוף',
      seoOgDescription: 'תיאור לשיתוף',
      seoOgImageUrl: 'https://example.test/og.jpg',
      seoNoindex: true,
    };

    await talentRepository.updateTalentVersionFields('v-1', fields);

    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0][0].data).toEqual(fields);
  });

  it('a partial SEO save writes only the provided keys (no column clobbering)', async () => {
    await talentRepository.updateTalentVersionFields('v-1', { seoTitle: 'רק כותרת' });

    expect(update.mock.calls[0][0].data).toEqual({ seoTitle: 'רק כותרת' });
  });

  it('explicit nulls clear SEO fields deliberately (fall back to smart defaults)', async () => {
    await talentRepository.updateTalentVersionFields('v-1', {
      seoTitle: null,
      seoOgImageUrl: null,
    });

    expect(update.mock.calls[0][0].data).toEqual({ seoTitle: null, seoOgImageUrl: null });
  });

  it('still drops lifecycle/relation keys — the allowlist was not widened beyond slug+SEO', async () => {
    await talentRepository.updateTalentVersionFields('v-1', {
      slug: 'ok-slug',
      status: 'PUBLISHED',
      talentId: 't-2',
      approvedById: 'u-1',
      seoBogus: 'x',
    });

    expect(update.mock.calls[0][0].data).toEqual({ slug: 'ok-slug' });
  });
});
