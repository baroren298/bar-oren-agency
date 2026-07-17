/*
 * POST /api/admin/clients/[id]/archive — RETIRED route (Website CMS Focus
 * Cleanup).
 *
 * Retired from the Website CMS: returns the uniform retired 404 (see
 * ../../../retiredRouteContract.js) BEFORE the OWNER-only gate or the client
 * service can run. The Sprint 7B contract this file used to assert
 * (401/403/200/409 + Hebrew owner-only message) is intentionally gone; the
 * OWNER-only authorization rule itself remains proven in
 * lib/admin/clientService.test.js (service unchanged).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mustNotRun = (what) => () => {
    throw new Error(`${what} must not run on a retired route`);
  };
  return {
    requireOwner: vi.fn(mustNotRun('auth')),
    archiveClient: vi.fn(mustNotRun('service')),
  };
});

vi.mock('@/lib/admin/auth/authorize', () => ({ requireOwner: mocks.requireOwner }));
vi.mock('@/lib/admin/clientService', () => ({
  clientService: { archiveClient: mocks.archiveClient },
}));

import { POST } from './route';
import {
  expectRetiredResponse,
  makeRetiredRequest,
  makeRetiredCtx,
} from '../../../retiredRouteContract';

beforeEach(() => vi.clearAllMocks());

describe('POST /api/admin/clients/[id]/archive (retired)', () => {
  it('returns the retired 404 without touching the OWNER gate or the service', async () => {
    const req = makeRetiredRequest();
    await expectRetiredResponse(await POST(req, makeRetiredCtx('client-1')), { req });
    expect(mocks.requireOwner).not.toHaveBeenCalled();
    expect(mocks.archiveClient).not.toHaveBeenCalled();
  });
});
