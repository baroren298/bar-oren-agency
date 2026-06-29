/*
 * POST /api/admin/talent/[id]/proposals/[versionId]/discard — route-level
 * coverage (Cancel Editing / Discard Draft sprint).
 *
 * Complements lib/admin/engine/__tests__/proposalLifecycle.test.js's
 * proposalService.discard() block, which already covers the DRAFT-only
 * business rule at the engine layer. This file instead covers the things
 * that only exist at the HTTP/route layer: the requireOwnerOrEmployee auth
 * gate (401 when unauthenticated), that both OWNER and EMPLOYEE sessions are
 * let through, and the route's own pre-check that returns 409 (with
 * `code: 'NOT_DISCARDABLE'`) for a non-DRAFT version *before*
 * proposalService.discard() is even called — defense in depth on top of
 * that service's own guard.
 *
 * `requireOwnerOrEmployee`, `talentAdapter`, and `proposalService` are all
 * mocked here (unlike the engine-level test file, which exercises the real
 * proposalService against a fake adapter) — this file's job is to verify
 * the route wires those three together correctly, not to re-prove the
 * business rule itself.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  requireOwnerOrEmployee: vi.fn(),
  getParent: vi.fn(),
  getVersion: vi.fn(),
  discard: vi.fn(),
}));

vi.mock('@/lib/admin/auth/authorize', () => ({
  requireOwnerOrEmployee: hoisted.requireOwnerOrEmployee,
}));

vi.mock('@/lib/admin/engine/adapters/talentAdapter', () => ({
  talentAdapter: {
    entityType: 'TALENT',
    getParent: hoisted.getParent,
    getVersion: hoisted.getVersion,
  },
}));

vi.mock('@/lib/admin/engine/proposalService', () => ({
  proposalService: {
    discard: hoisted.discard,
  },
}));

import { POST } from './route';
import { VERSION_STATUS } from '@/lib/admin/constants/enums';
import { ROLE } from '@/lib/admin/constants/enums';

function makeRequest() {
  // The route never reads anything off the request itself beyond what
  // requireOwnerOrEmployee(request) does internally (which is mocked), so
  // an empty object is a sufficient stand-in for a NextRequest here.
  return {};
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.getParent.mockResolvedValue({ id: 'talent-1' });
});

describe('POST .../discard', () => {
  it('returns 401 when there is no valid session (unauthenticated cannot discard)', async () => {
    hoisted.requireOwnerOrEmployee.mockRejectedValue(
      Object.assign(new Error('Not authenticated'), { statusCode: 401 })
    );

    const response = await POST(makeRequest(), {
      params: Promise.resolve({ id: 'talent-1', versionId: 'version-1' }),
    });

    expect(response.status).toBe(401);
    expect(hoisted.discard).not.toHaveBeenCalled();
  });

  it('EMPLOYEE can discard a DRAFT version', async () => {
    hoisted.requireOwnerOrEmployee.mockResolvedValue({ userId: 'employee-1', role: ROLE.EMPLOYEE });
    hoisted.getVersion.mockResolvedValue({ id: 'version-1', talentId: 'talent-1', status: VERSION_STATUS.DRAFT });
    hoisted.discard.mockResolvedValue({ discarded: true });

    const response = await POST(makeRequest(), {
      params: Promise.resolve({ id: 'talent-1', versionId: 'version-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ discarded: true });
    expect(hoisted.discard).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'TALENT' }),
      { parentId: 'talent-1', versionId: 'version-1', actorId: 'employee-1' }
    );
  });

  it('OWNER can discard a DRAFT version', async () => {
    hoisted.requireOwnerOrEmployee.mockResolvedValue({ userId: 'owner-1', role: ROLE.OWNER });
    hoisted.getVersion.mockResolvedValue({ id: 'version-1', talentId: 'talent-1', status: VERSION_STATUS.DRAFT });
    hoisted.discard.mockResolvedValue({ discarded: true });

    const response = await POST(makeRequest(), {
      params: Promise.resolve({ id: 'talent-1', versionId: 'version-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ discarded: true });
    expect(hoisted.discard).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'TALENT' }),
      { parentId: 'talent-1', versionId: 'version-1', actorId: 'owner-1' }
    );
  });

  it('returns 409 with code NOT_DISCARDABLE for a PROPOSED version, without calling proposalService.discard', async () => {
    hoisted.requireOwnerOrEmployee.mockResolvedValue({ userId: 'owner-1', role: ROLE.OWNER });
    hoisted.getVersion.mockResolvedValue({
      id: 'version-1',
      talentId: 'talent-1',
      status: VERSION_STATUS.PROPOSED,
    });

    const response = await POST(makeRequest(), {
      params: Promise.resolve({ id: 'talent-1', versionId: 'version-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('NOT_DISCARDABLE');
    expect(body.status).toBe(VERSION_STATUS.PROPOSED);
    expect(hoisted.discard).not.toHaveBeenCalled();
  });

  it('returns 404 when the talent does not exist', async () => {
    hoisted.requireOwnerOrEmployee.mockResolvedValue({ userId: 'owner-1', role: ROLE.OWNER });
    hoisted.getParent.mockResolvedValue(null);

    const response = await POST(makeRequest(), {
      params: Promise.resolve({ id: 'missing-talent', versionId: 'version-1' }),
    });

    expect(response.status).toBe(404);
    expect(hoisted.discard).not.toHaveBeenCalled();
  });

  it('returns 404 when the version does not belong to the talent', async () => {
    hoisted.requireOwnerOrEmployee.mockResolvedValue({ userId: 'owner-1', role: ROLE.OWNER });
    hoisted.getVersion.mockResolvedValue({
      id: 'version-1',
      talentId: 'some-other-talent',
      status: VERSION_STATUS.DRAFT,
    });

    const response = await POST(makeRequest(), {
      params: Promise.resolve({ id: 'talent-1', versionId: 'version-1' }),
    });

    expect(response.status).toBe(404);
    expect(hoisted.discard).not.toHaveBeenCalled();
  });
});
