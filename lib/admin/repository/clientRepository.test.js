/*
 * clientRepository — unit tests (Sprint 7B: Clients & Brands Foundation).
 *
 * Prisma is mocked (no test may touch a real database). This file proves
 * the transactional uniqueness mechanism — the in-transaction pre-check,
 * the self-exclusion on update, and the P2002 backstop translation — plus
 * the archive stamp (status + deletedAt/deletedBy, never a delete call).
 * All fixtures are synthetic Demo data.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  txFindUnique: vi.fn(),
  txCreate: vi.fn(),
  txUpdate: vi.fn(),
}));

vi.mock('../db', () => {
  const tx = {
    client: {
      findUnique: hoisted.txFindUnique,
      create: hoisted.txCreate,
      update: hoisted.txUpdate,
    },
  };
  return {
    prisma: {
      $transaction: vi.fn(async (callback) => callback(tx)),
      client: {
        findMany: hoisted.findMany,
        findUnique: hoisted.findUnique,
        create: hoisted.create,
        update: hoisted.update,
      },
    },
  };
});

import { clientRepository } from './clientRepository';
import {
  LIFECYCLE_STATUS,
  CLIENT_NAME_CONFLICT_ERROR_CODE,
} from '../constants/enums';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('clientRepository.listClients', () => {
  it('filters to ACTIVE by default and selects the filtered active-brand count', async () => {
    hoisted.findMany.mockResolvedValue([]);
    await clientRepository.listClients();

    const args = hoisted.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ status: LIFECYCLE_STATUS.ACTIVE });
    expect(args.include._count.select.brands.where).toEqual({ status: LIFECYCLE_STATUS.ACTIVE });
    expect(args.orderBy).toEqual({ name: 'asc' });
  });

  it('drops the status filter when includeArchived is true', async () => {
    hoisted.findMany.mockResolvedValue([]);
    await clientRepository.listClients({ includeArchived: true });
    expect(hoisted.findMany.mock.calls[0][0].where).toEqual({});
  });
});

describe('clientRepository.createClient', () => {
  const input = {
    name: 'לקוח דמו א׳',
    normalizedName: 'לקוח דמו א׳',
  };

  it('creates when the in-transaction pre-check finds no collision', async () => {
    hoisted.txFindUnique.mockResolvedValue(null);
    hoisted.txCreate.mockResolvedValue({ id: 'client-1', ...input });

    const result = await clientRepository.createClient(input);

    expect(hoisted.txFindUnique).toHaveBeenCalledWith({
      where: { normalizedName: 'לקוח דמו א׳' },
      select: { id: true },
    });
    expect(result).toMatchObject({ id: 'client-1' });
  });

  it('throws the CLIENT_NAME_CONFLICT code when the pre-check finds any row — archived included (no status filter)', async () => {
    hoisted.txFindUnique.mockResolvedValue({ id: 'archived-client' });

    await expect(clientRepository.createClient(input)).rejects.toMatchObject({
      code: CLIENT_NAME_CONFLICT_ERROR_CODE,
    });
    expect(hoisted.txCreate).not.toHaveBeenCalled();
    // The uniqueness lookup deliberately has NO status/deletedAt condition.
    expect(hoisted.txFindUnique.mock.calls[0][0].where).toEqual({
      normalizedName: 'לקוח דמו א׳',
    });
  });

  it('maps a P2002 race (DB unique-index backstop) to the same conflict code', async () => {
    hoisted.txFindUnique.mockResolvedValue(null);
    hoisted.txCreate.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

    await expect(clientRepository.createClient(input)).rejects.toMatchObject({
      code: CLIENT_NAME_CONFLICT_ERROR_CODE,
    });
  });
});

describe('clientRepository.updateClient', () => {
  it('allows a rename when the only matching row is the client itself (self-exclusion)', async () => {
    hoisted.txFindUnique.mockResolvedValue({ id: 'client-1' });
    hoisted.txUpdate.mockResolvedValue({ id: 'client-1' });

    await clientRepository.updateClient('client-1', {
      name: 'לקוח דמו א׳',
      normalizedName: 'לקוח דמו א׳',
    });

    expect(hoisted.txUpdate).toHaveBeenCalled();
  });

  it('throws the conflict code when another client holds the normalized name', async () => {
    hoisted.txFindUnique.mockResolvedValue({ id: 'other-client' });

    await expect(
      clientRepository.updateClient('client-1', { normalizedName: 'לקוח דמו ב׳' })
    ).rejects.toMatchObject({ code: CLIENT_NAME_CONFLICT_ERROR_CODE });
    expect(hoisted.txUpdate).not.toHaveBeenCalled();
  });

  it('skips the uniqueness lookup entirely when the update carries no normalizedName', async () => {
    hoisted.txUpdate.mockResolvedValue({ id: 'client-1' });
    await clientRepository.updateClient('client-1', { notes: 'הערת דמו' });
    expect(hoisted.txFindUnique).not.toHaveBeenCalled();
  });
});

describe('clientRepository.archiveClient', () => {
  it('flips status to ARCHIVED and stamps deletedAt/deletedBy — never deletes', async () => {
    hoisted.update.mockResolvedValue({ id: 'client-1', status: LIFECYCLE_STATUS.ARCHIVED });

    await clientRepository.archiveClient('client-1', 'owner-1');

    const args = hoisted.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'client-1' });
    expect(args.data.status).toBe(LIFECYCLE_STATUS.ARCHIVED);
    expect(args.data.deletedAt).toBeInstanceOf(Date);
    expect(args.data.deletedBy).toBe('owner-1');
  });
});
