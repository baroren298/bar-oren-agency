/*
 * GET/POST /api/admin/clients — RETIRED route (Website CMS Focus Cleanup).
 *
 * Clients is a My Agency business module retired from the Website CMS: this
 * route now returns the uniform retired 404 (see ../retiredRouteContract.js)
 * BEFORE authentication or the client service can run. The Sprint 7B
 * contract this file used to assert (200/201/400/401/409 + Hebrew errors) is
 * intentionally gone. Service-layer rules remain covered, unchanged, by
 * lib/admin/clientService.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mustNotRun = (what) => () => {
    throw new Error(`${what} must not run on a retired route`);
  };
  return {
    requireOwnerOrEmployee: vi.fn(mustNotRun('auth')),
    listClients: vi.fn(mustNotRun('service')),
    createClient: vi.fn(mustNotRun('service')),
  };
});

vi.mock('@/lib/admin/auth/authorize', () => ({
  requireOwnerOrEmployee: mocks.requireOwnerOrEmployee,
}));
vi.mock('@/lib/admin/clientService', () => ({
  clientService: { listClients: mocks.listClients, createClient: mocks.createClient },
}));

import { GET, POST } from './route';
import { expectRetiredResponse, makeRetiredRequest } from '../retiredRouteContract';

beforeEach(() => vi.clearAllMocks());

describe('GET/POST /api/admin/clients (retired)', () => {
  it('GET returns the retired 404 without touching auth or the service', async () => {
    const req = makeRetiredRequest();
    await expectRetiredResponse(await GET(req), { req });
    expect(mocks.requireOwnerOrEmployee).not.toHaveBeenCalled();
    expect(mocks.listClients).not.toHaveBeenCalled();
  });

  it('POST returns the retired 404 without parsing the body, auth, or the service', async () => {
    const req = makeRetiredRequest({ name: 'x', notes: 'secret' });
    await expectRetiredResponse(await POST(req), { req });
    expect(mocks.requireOwnerOrEmployee).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
