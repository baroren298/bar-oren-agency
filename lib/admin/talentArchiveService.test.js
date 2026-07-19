/*
 * talentArchiveService — unit coverage for the Talent Archive & Restore
 * feature.
 *
 * Mocks talentAdapter and eventService, same "verify the service wires
 * things together correctly, not the business logic underneath" boundary
 * app/api/admin/talent/route.test.js already uses for its own mocks. Covers:
 *   - OWNER-only enforcement for both archiveTalent and restoreTalent
 *     (independent of any route-level gate)
 *   - not-found handling
 *   - idempotence: archive-when-already-archived and
 *     restore-when-not-archived both 409 without calling the mutating
 *     adapter method
 *   - the success path calls the correct adapter method and emits the
 *     correct event with an allowlisted payload
 *   - a failed event emission never rethrows (committed-mutation-wins)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  getParent: vi.fn(),
  archiveParent: vi.fn(),
  restoreParent: vi.fn(),
  emit: vi.fn(),
}));

vi.mock('./engine/adapters/talentAdapter', () => ({
  talentAdapter: {
    getParent: hoisted.getParent,
    archiveParent: hoisted.archiveParent,
    restoreParent: hoisted.restoreParent,
  },
}));

vi.mock('./engine/eventService', () => ({
  eventService: { emit: hoisted.emit },
}));

import { talentArchiveService } from './talentArchiveService';
import { ROLE, LIFECYCLE_STATUS } from './constants/enums';
import { EVENT_TYPE } from './engine/eventTypes';
import { he } from './i18n/he';

const ERR = he.talent.archive.errors;

const ACTIVE_TALENT = Object.freeze({
  id: 'talent-1',
  slug: 'noa-cohen',
  status: LIFECYCLE_STATUS.ACTIVE,
});

const ARCHIVED_TALENT = Object.freeze({
  id: 'talent-1',
  slug: 'noa-cohen',
  status: LIFECYCLE_STATUS.ARCHIVED,
});

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.emit.mockResolvedValue(undefined);
});

describe('talentArchiveService.archiveTalent', () => {
  it('throws a 403 for a non-OWNER actor without reading or mutating anything', async () => {
    await expect(
      talentArchiveService.archiveTalent('talent-1', { actorId: 'u1', actorRole: ROLE.EMPLOYEE })
    ).rejects.toMatchObject({ statusCode: 403, message: ERR.ownerOnly });

    expect(hoisted.getParent).not.toHaveBeenCalled();
    expect(hoisted.archiveParent).not.toHaveBeenCalled();
    expect(hoisted.emit).not.toHaveBeenCalled();
  });

  it('throws a 404 when the talent does not exist', async () => {
    hoisted.getParent.mockResolvedValue(null);

    await expect(
      talentArchiveService.archiveTalent('missing', { actorId: 'owner-1', actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 404, message: ERR.talentNotFound });

    expect(hoisted.archiveParent).not.toHaveBeenCalled();
  });

  it('throws a 409 when the talent is already archived, without mutating anything', async () => {
    hoisted.getParent.mockResolvedValue({ ...ARCHIVED_TALENT });

    await expect(
      talentArchiveService.archiveTalent('talent-1', { actorId: 'owner-1', actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 409, code: 'TALENT_ALREADY_ARCHIVED' });

    expect(hoisted.archiveParent).not.toHaveBeenCalled();
    expect(hoisted.emit).not.toHaveBeenCalled();
  });

  it('archives an active talent and emits TALENT_ARCHIVED with an allowlisted payload', async () => {
    hoisted.getParent.mockResolvedValue({ ...ACTIVE_TALENT });
    hoisted.archiveParent.mockResolvedValue({ ...ARCHIVED_TALENT });

    const result = await talentArchiveService.archiveTalent('talent-1', {
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
      correlationId: 'corr-1',
      requestMetadata: { ipAddress: '1.2.3.4', userAgent: 'test' },
    });

    expect(result).toEqual(ARCHIVED_TALENT);
    expect(hoisted.archiveParent).toHaveBeenCalledWith('talent-1', { actorId: 'owner-1' });
    expect(hoisted.emit).toHaveBeenCalledTimes(1);
    expect(hoisted.emit).toHaveBeenCalledWith(EVENT_TYPE.TALENT_ARCHIVED, {
      entityType: 'TALENT',
      entityId: 'talent-1',
      actorId: 'owner-1',
      correlationId: 'corr-1',
      payload: { slug: 'noa-cohen', status: LIFECYCLE_STATUS.ARCHIVED },
      metadata: { ipAddress: '1.2.3.4', userAgent: 'test' },
    });
  });

  it('does not rethrow when event emission fails — the committed archive still succeeds', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    hoisted.getParent.mockResolvedValue({ ...ACTIVE_TALENT });
    hoisted.archiveParent.mockResolvedValue({ ...ARCHIVED_TALENT });
    hoisted.emit.mockRejectedValue(new Error('event bus down'));

    const result = await talentArchiveService.archiveTalent('talent-1', {
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
    });

    expect(result).toEqual(ARCHIVED_TALENT);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

describe('talentArchiveService.restoreTalent', () => {
  it('throws a 403 for a non-OWNER actor', async () => {
    await expect(
      talentArchiveService.restoreTalent('talent-1', { actorId: 'u1', actorRole: ROLE.EMPLOYEE })
    ).rejects.toMatchObject({ statusCode: 403, message: ERR.ownerOnly });

    expect(hoisted.restoreParent).not.toHaveBeenCalled();
  });

  it('throws a 409 when the talent is not archived, without mutating anything', async () => {
    hoisted.getParent.mockResolvedValue({ ...ACTIVE_TALENT });

    await expect(
      talentArchiveService.restoreTalent('talent-1', { actorId: 'owner-1', actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 409, code: 'TALENT_NOT_ARCHIVED' });

    expect(hoisted.restoreParent).not.toHaveBeenCalled();
    expect(hoisted.emit).not.toHaveBeenCalled();
  });

  it('restores an archived talent and emits TALENT_RESTORED with an allowlisted payload', async () => {
    hoisted.getParent.mockResolvedValue({ ...ARCHIVED_TALENT });
    hoisted.restoreParent.mockResolvedValue({ ...ACTIVE_TALENT });

    const result = await talentArchiveService.restoreTalent('talent-1', {
      actorId: 'owner-1',
      actorRole: ROLE.OWNER,
      correlationId: 'corr-2',
    });

    expect(result).toEqual(ACTIVE_TALENT);
    expect(hoisted.restoreParent).toHaveBeenCalledWith('talent-1');
    expect(hoisted.emit).toHaveBeenCalledWith(EVENT_TYPE.TALENT_RESTORED, {
      entityType: 'TALENT',
      entityId: 'talent-1',
      actorId: 'owner-1',
      correlationId: 'corr-2',
      payload: { slug: 'noa-cohen', status: LIFECYCLE_STATUS.ACTIVE },
      metadata: {},
    });
  });
});
