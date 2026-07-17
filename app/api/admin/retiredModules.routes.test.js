/*
 * Website CMS Focus Cleanup — retired Clients & Brands API routes,
 * cross-cutting coverage.
 *
 * The retired-route CONTRACT is defined once in ./retiredRouteContract.js
 * and each route's own colocated *.test.js verifies it. This suite adds the
 * two things that have no natural single-route home:
 *
 *   1. The two handlers that never had a colocated test — clients/[id]
 *      (GET, PATCH) and clients/[id]/brands (POST) — verified against the
 *      shared contract here.
 *   2. An INVARIANCE guarantee: every one of the eight retired handlers
 *      returns an identical response regardless of role, auth state, request
 *      body, or route id — proving the gate takes no input and leaks no
 *      record-existence signal.
 *
 * Auth and service are mocked (via the repo's vi.hoisted() pattern) to throw
 * if reached and asserted never to run — the gate is an ADDITIONAL boundary
 * in front of the still-present, unchanged auth/service code.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RETIRED_BODY,
  expectRetiredResponse,
  makeRetiredRequest,
  makeRetiredCtx,
} from './retiredRouteContract';

const mocks = vi.hoisted(() => {
  const mustNotRun = (what) => () => {
    throw new Error(`${what} must not run on a retired route`);
  };
  return {
    requireOwner: vi.fn(mustNotRun('auth')),
    requireOwnerOrEmployee: vi.fn(mustNotRun('auth')),
    service: {
      listClients: vi.fn(mustNotRun('service')),
      createClient: vi.fn(mustNotRun('service')),
      getClientDetail: vi.fn(mustNotRun('service')),
      updateClient: vi.fn(mustNotRun('service')),
      archiveClient: vi.fn(mustNotRun('service')),
      createBrand: vi.fn(mustNotRun('service')),
      updateBrand: vi.fn(mustNotRun('service')),
      archiveBrand: vi.fn(mustNotRun('service')),
    },
  };
});

vi.mock('@/lib/admin/auth/authorize', () => ({
  requireOwner: mocks.requireOwner,
  requireOwnerOrEmployee: mocks.requireOwnerOrEmployee,
}));
vi.mock('@/lib/admin/clientService', () => ({ clientService: mocks.service }));

import * as clientsList from './clients/route';
import * as clientDetail from './clients/[id]/route';
import * as clientArchive from './clients/[id]/archive/route';
import * as clientBrands from './clients/[id]/brands/route';
import * as brandDetail from './brands/[id]/route';
import * as brandArchive from './brands/[id]/archive/route';

beforeEach(() => vi.clearAllMocks());

describe('retired clients/[id] and clients/[id]/brands (no colocated test)', () => {
  it('GET /clients/[id] returns the retired 404 before auth or the service', async () => {
    const req = makeRetiredRequest();
    await expectRetiredResponse(await clientDetail.GET(req, makeRetiredCtx('c1')), { req });
    expect(mocks.requireOwnerOrEmployee).not.toHaveBeenCalled();
    expect(mocks.service.getClientDetail).not.toHaveBeenCalled();
  });

  it('PATCH /clients/[id] returns the retired 404 without parsing the body or the service', async () => {
    const req = makeRetiredRequest({ name: 'x', notes: 'secret' });
    await expectRetiredResponse(await clientDetail.PATCH(req, makeRetiredCtx('c1')), { req });
    expect(mocks.requireOwnerOrEmployee).not.toHaveBeenCalled();
    expect(mocks.service.updateClient).not.toHaveBeenCalled();
  });

  it('POST /clients/[id]/brands returns the retired 404 without parsing the body or the service', async () => {
    const req = makeRetiredRequest({ name: 'x' });
    await expectRetiredResponse(await clientBrands.POST(req, makeRetiredCtx('c1')), { req });
    expect(mocks.requireOwnerOrEmployee).not.toHaveBeenCalled();
    expect(mocks.service.createBrand).not.toHaveBeenCalled();
  });
});

describe('retired-route invariance across all eight handlers', () => {
  const ALL = [
    (req, ctx) => clientsList.GET(req, ctx),
    (req, ctx) => clientsList.POST(req, ctx),
    (req, ctx) => clientDetail.GET(req, ctx),
    (req, ctx) => clientDetail.PATCH(req, ctx),
    (req, ctx) => clientArchive.POST(req, ctx),
    (req, ctx) => clientBrands.POST(req, ctx),
    (req, ctx) => brandDetail.PATCH(req, ctx),
    (req, ctx) => brandArchive.POST(req, ctx),
  ];

  it('is identical regardless of role, auth state, request body, or route id', async () => {
    const bodyVariants = [undefined, {}, { name: 'x', contactEmail: 'a@b.c', notes: 'secret' }];
    const idVariants = ['', 'client-1', 'brand-1', '../smuggled'];

    const seen = new Set();
    for (const invoke of ALL) {
      for (const body of bodyVariants) {
        for (const id of idVariants) {
          const res = await invoke(makeRetiredRequest(body), makeRetiredCtx(id));
          seen.add(`${res.status}:${JSON.stringify(await res.json())}`);
        }
      }
    }
    expect([...seen]).toEqual([`404:${JSON.stringify(RETIRED_BODY)}`]);
  });

  it('never reaches authentication, authorization, or any service method', async () => {
    for (const invoke of ALL) {
      await invoke(makeRetiredRequest(), makeRetiredCtx());
    }
    expect(mocks.requireOwner).not.toHaveBeenCalled();
    expect(mocks.requireOwnerOrEmployee).not.toHaveBeenCalled();
    for (const fn of Object.values(mocks.service)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });
});
