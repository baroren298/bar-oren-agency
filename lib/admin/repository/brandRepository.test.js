/*
 * brandRepository — unit tests (Sprint 7B: Clients & Brands Foundation).
 *
 * Prisma is mocked. The critical behavior proven here is the SCOPE of the
 * uniqueness check: the (clientId, normalizedName) composite — so the same
 * brand name under a DIFFERENT client is legitimate, while any row
 * (archived included) under the SAME client collides. Plus the P2002
 * backstop and the archive stamp. Synthetic Demo fixtures only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  txFindUnique: vi.fn(),
  txCreate: vi.fn(),
  txUpdate: vi.fn(),
}));

vi.mock('../db', () => {
  const tx = {
    brand: {
      findUnique: hoisted.txFindUnique,
      create: hoisted.txCreate,
      update: hoisted.txUpdate,
    },
  };
  return {
    prisma: {
      $transaction: vi.fn(async (callback) => callback(tx)),
      brand: {
        findUnique: hoisted.findUnique,
        update: hoisted.update,
      },
    },
  };
});

import { brandRepository } from './brandRepository';
import {
  LIFECYCLE_STATUS,
  BRAND_NAME_CONFLICT_ERROR_CODE,
} from '../constants/enums';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('brandRepository.createBrand', () => {
  const input = {
    clientId: 'client-1',
    name: 'מותג דמו קיץ',
    normalizedName: 'מותג דמו קיץ',
  };

  it('checks uniqueness against the (clientId, normalizedName) composite only', async () => {
    hoisted.txFindUnique.mockResolvedValue(null);
    hoisted.txCreate.mockResolvedValue({ id: 'brand-1', ...input });

    await brandRepository.createBrand(input);

    expect(hoisted.txFindUnique).toHaveBeenCalledWith({
      where: {
        clientId_normalizedName: {
          clientId: 'client-1',
          normalizedName: 'מותג דמו קיץ',
        },
      },
      select: { id: true },
    });
    // Scoped by clientId ⇒ the same name under client-2 would query a
    // different composite key and never collide with client-1's brand.
  });

  it('throws BRAND_NAME_CONFLICT when any row (archived included) holds the composite', async () => {
    hoisted.txFindUnique.mockResolvedValue({ id: 'archived-brand' });

    await expect(brandRepository.createBrand(input)).rejects.toMatchObject({
      code: BRAND_NAME_CONFLICT_ERROR_CODE,
    });
    expect(hoisted.txCreate).not.toHaveBeenCalled();
  });

  it('maps a P2002 race to the same conflict code', async () => {
    hoisted.txFindUnique.mockResolvedValue(null);
    hoisted.txCreate.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

    await expect(brandRepository.createBrand(input)).rejects.toMatchObject({
      code: BRAND_NAME_CONFLICT_ERROR_CODE,
    });
  });
});

describe('brandRepository.updateBrand', () => {
  it('allows a rename when the only composite match is the brand itself', async () => {
    hoisted.txFindUnique.mockResolvedValue({ id: 'brand-1' });
    hoisted.txUpdate.mockResolvedValue({ id: 'brand-1' });

    await brandRepository.updateBrand('brand-1', 'client-1', {
      name: 'מותג דמו בית',
      normalizedName: 'מותג דמו בית',
    });

    expect(hoisted.txUpdate).toHaveBeenCalled();
  });

  it('throws the conflict code when a sibling brand holds the name within the same client', async () => {
    hoisted.txFindUnique.mockResolvedValue({ id: 'sibling-brand' });

    await expect(
      brandRepository.updateBrand('brand-1', 'client-1', { normalizedName: 'מותג דמו בית' })
    ).rejects.toMatchObject({ code: BRAND_NAME_CONFLICT_ERROR_CODE });
    expect(hoisted.txUpdate).not.toHaveBeenCalled();
  });
});

describe('brandRepository.archiveBrand', () => {
  it('flips status to ARCHIVED and stamps deletedAt/deletedBy — never deletes', async () => {
    hoisted.update.mockResolvedValue({ id: 'brand-1', status: LIFECYCLE_STATUS.ARCHIVED });

    await brandRepository.archiveBrand('brand-1', 'owner-1');

    const args = hoisted.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'brand-1' });
    expect(args.data.status).toBe(LIFECYCLE_STATUS.ARCHIVED);
    expect(args.data.deletedAt).toBeInstanceOf(Date);
    expect(args.data.deletedBy).toBe('owner-1');
  });
});
