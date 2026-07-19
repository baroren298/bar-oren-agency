/*
 * POST /api/admin/talent/[id]/archive — route-level coverage for the
 * Talent Archive & Restore feature. Mocks requireOwner and
 * talentArchiveService, same boundary app/api/admin/talent/route.test.js
 * already uses — this file verifies the route wires auth + the service
 * together correctly, not the service's own business logic (covered by
 * lib/admin/talentArchiveService.test.js).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  archiveTalent: vi.fn(),
}));

vi.mock('@/lib/admin/auth/authorize', () => ({
  requireOwner: hoisted.requireOwner,
}));

vi.mock('@/lib/admin/talentArchiveService', () => ({
  talentArchiveService: { archiveTalent: hoisted.archiveTalent },
}));

import { POST } from './route';
import { ROLE, LIFECYCLE_STATUS } from '@/lib/admin/constants/enums';
import { he } from '@/lib/admin/i18n/he';

const ERR = he.talent.archive.errors;

function makeRequest() {
  return { headers: new Headers() };
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: ROLE.OWNER });
  hoisted.archiveTalent.mockResolvedValue({
    id: 'talent-1',
    slug: 'noa-cohen',
    status: LIFECYCLE_STATUS.ARCHIVED,
  });
});

describe('POST /api/admin/talent/[id]/archive', () => {
  it('returns 401 when there is no valid session, without calling the service', async () => {
    hoisted.requireOwner.mockRejectedValue(
      Object.assign(new Error('Not authenticated'), { statusCode: 401 })
    );

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: 'talent-1' }) });

    expect(response.status).toBe(401);
    expect(hoisted.archiveTalent).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-Owner session, without calling the service', async () => {
    hoisted.requireOwner.mockRejectedValue(
      Object.assign(new Error('Forbidden'), { statusCode: 403 })
    );

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: 'talent-1' }) });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe(ERR.ownerOnly);
    expect(hoisted.archiveTalent).not.toHaveBeenCalled();
  });

  it('returns 400 when the id param is missing', async () => {
    const response = await POST(makeRequest(), { params: Promise.resolve({}) });

    expect(response.status).toBe(400);
    expect(hoisted.archiveTalent).not.toHaveBeenCalled();
  });

  it('returns 200 with the archived talent on success, forwarding the actor', async () => {
    const response = await POST(makeRequest(), { params: Promise.resolve({ id: 'talent-1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.talent.status).toBe(LIFECYCLE_STATUS.ARCHIVED);
    expect(hoisted.archiveTalent).toHaveBeenCalledWith(
      'talent-1',
      expect.objectContaining({ actorId: 'owner-1', actorRole: ROLE.OWNER })
    );
  });

  it('surfaces a service 409 (already archived) as-is', async () => {
    hoisted.archiveTalent.mockRejectedValue(
      Object.assign(new Error(ERR.talentAlreadyArchived), {
        statusCode: 409,
        code: 'TALENT_ALREADY_ARCHIVED',
      })
    );

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: 'talent-1' }) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('TALENT_ALREADY_ARCHIVED');
  });

  it('normalizes an unexpected service error to a generic 500 without leaking internals', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    hoisted.archiveTalent.mockRejectedValue(new Error('connect ECONNREFUSED db.internal:5432'));

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: 'talent-1' }) });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe(ERR.serverError);
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
    consoleErrorSpy.mockRestore();
  });
});
