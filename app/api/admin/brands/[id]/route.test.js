/*
 * PATCH /api/admin/brands/[id] — RETIRED route (Website CMS Focus Cleanup).
 *
 * Brands is part of the retired Clients module: this route now returns the
 * uniform retired 404 (see ../../retiredRouteContract.js) BEFORE
 * authentication, body parsing, or the brand service can run. The Sprint 7B
 * contract this file used to assert (200/400/401/409 + explicit field pick +
 * Hebrew errors) is intentionally gone. Service-layer rules remain covered,
 * unchanged, by lib/admin/clientService.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mustNotRun = (what) => () => {
    throw new Error(`${what} must not run on a retired route`);
  };
  return {
    requireOwnerOrEmployee: vi.fn(mustNotRun('auth')),
    updateBrand: vi.fn(mustNotRun('service')),
  };
});

vi.mock('@/lib/admin/auth/authorize', () => ({
  requireOwnerOrEmployee: mocks.requireOwnerOrEmployee,
}));
vi.mock('@/lib/admin/clientService', () => ({
  clientService: { updateBrand: mocks.updateBrand },
}));

import { PATCH } from './route';
import {
  expectRetiredResponse,
  makeRetiredRequest,
  makeRetiredCtx,
} from '../../retiredRouteContract';

beforeEach(() => vi.clearAllMocks());

describe('PATCH /api/admin/brands/[id] (retired)', () => {
  it('returns the retired 404 without parsing the body, auth, or the service', async () => {
    const req = makeRetiredRequest({ name: 'x', clientId: 'other', status: 'SMUGGLED' });
    await expectRetiredResponse(await PATCH(req, makeRetiredCtx('brand-1')), { req });
    expect(mocks.requireOwnerOrEmployee).not.toHaveBeenCalled();
    expect(mocks.updateBrand).not.toHaveBeenCalled();
  });
});
