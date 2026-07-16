/*
 * PATCH /api/admin/brands/[id] — route-level coverage (Sprint 7B).
 *
 * Verifies the wiring: both business roles pass the gate, the body is
 * explicitly picked (name/notes only — nothing else can be smuggled), and
 * the service's Hebrew errors pass through untouched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  requireOwnerOrEmployee: vi.fn(),
  updateBrand: vi.fn(),
}));

vi.mock('@/lib/admin/auth/authorize', () => ({
  requireOwnerOrEmployee: hoisted.requireOwnerOrEmployee,
}));

vi.mock('@/lib/admin/clientService', () => ({
  clientService: {
    updateBrand: hoisted.updateBrand,
  },
}));

import { PATCH } from './route';
import { he } from '@/lib/admin/i18n/he';

function makeRequest(body) {
  return {
    json: async () => {
      if (body === undefined) throw new Error('no body');
      return body;
    },
    headers: { get: () => null },
  };
}

function makeContext(id) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH /api/admin/brands/[id]', () => {
  it('returns 401 when there is no valid session', async () => {
    hoisted.requireOwnerOrEmployee.mockRejectedValue(
      Object.assign(new Error('Not authenticated'), { statusCode: 401 })
    );

    const response = await PATCH(makeRequest({ name: 'מותג דמו קיץ' }), makeContext('brand-1'));

    expect(response.status).toBe(401);
    expect(hoisted.updateBrand).not.toHaveBeenCalled();
  });

  it('renames for an EMPLOYEE session with an explicit field pick (clientId can never be smuggled)', async () => {
    hoisted.requireOwnerOrEmployee.mockResolvedValue({ userId: 'emp-1', role: 'EMPLOYEE' });
    hoisted.updateBrand.mockResolvedValue({ id: 'brand-1', name: 'מותג דמו בית' });

    const response = await PATCH(
      makeRequest({ name: 'מותג דמו בית', clientId: 'other-client', status: 'SMUGGLED' }),
      makeContext('brand-1')
    );

    expect(response.status).toBe(200);
    const [brandId, fields, ctx] = hoisted.updateBrand.mock.calls[0];
    expect(brandId).toBe('brand-1');
    expect(fields).toEqual({ name: 'מותג דמו בית' });
    expect(ctx).toMatchObject({ actorId: 'emp-1', actorRole: 'EMPLOYEE' });
  });

  it('passes the within-client duplicate Hebrew 409 through untouched', async () => {
    hoisted.requireOwnerOrEmployee.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });
    hoisted.updateBrand.mockRejectedValue(
      Object.assign(new Error(he.clients.errors.brandNameTaken), {
        statusCode: 409,
        code: 'BRAND_NAME_CONFLICT',
        fieldErrors: { name: he.clients.errors.brandNameTaken },
      })
    );

    const response = await PATCH(makeRequest({ name: 'מותג דמו קיץ' }), makeContext('brand-1'));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe(he.clients.errors.brandNameTaken);
    expect(body.fieldErrors).toEqual({ name: he.clients.errors.brandNameTaken });
  });

  it('returns 400 with the Hebrew invalid-body message for unparseable JSON', async () => {
    hoisted.requireOwnerOrEmployee.mockResolvedValue({ userId: 'emp-1', role: 'EMPLOYEE' });

    const response = await PATCH(makeRequest(undefined), makeContext('brand-1'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe(he.clients.errors.invalidBody);
    expect(hoisted.updateBrand).not.toHaveBeenCalled();
  });
});
