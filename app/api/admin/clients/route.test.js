/*
 * GET/POST /api/admin/clients — route-level coverage (Sprint 7B: Clients &
 * Brands Foundation).
 *
 * requireOwnerOrEmployee and clientService are mocked — this file verifies
 * the route wiring only (auth gate for BOTH business roles, query/body
 * parsing, status mapping, Hebrew error passthrough), never the service's
 * own rules (clientService.test.js's job). Synthetic Demo fixtures only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  requireOwnerOrEmployee: vi.fn(),
  listClients: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('@/lib/admin/auth/authorize', () => ({
  requireOwnerOrEmployee: hoisted.requireOwnerOrEmployee,
}));

vi.mock('@/lib/admin/clientService', () => ({
  clientService: {
    listClients: hoisted.listClients,
    createClient: hoisted.createClient,
  },
}));

import { GET, POST } from './route';
import { he } from '@/lib/admin/i18n/he';

function makeRequest({ body, url = 'http://localhost/api/admin/clients' } = {}) {
  return {
    url,
    json: async () => {
      if (body === undefined) throw new Error('no body');
      return body;
    },
    headers: { get: () => null },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/clients', () => {
  it('returns 401 with the Hebrew message when there is no valid session', async () => {
    hoisted.requireOwnerOrEmployee.mockRejectedValue(
      Object.assign(new Error('Not authenticated'), { statusCode: 401 })
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe(he.clients.errors.notAuthenticated);
    expect(hoisted.listClients).not.toHaveBeenCalled();
  });

  it('lists for an EMPLOYEE session (both business roles may view)', async () => {
    hoisted.requireOwnerOrEmployee.mockResolvedValue({ userId: 'emp-1', role: 'EMPLOYEE' });
    hoisted.listClients.mockResolvedValue([{ id: 'client-1', name: 'לקוח דמו א׳' }]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.clients).toHaveLength(1);
    expect(hoisted.listClients).toHaveBeenCalledWith(
      { includeArchived: false },
      { actorRole: 'EMPLOYEE' }
    );
  });

  it('passes includeArchived=1 through to the service', async () => {
    hoisted.requireOwnerOrEmployee.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });
    hoisted.listClients.mockResolvedValue([]);

    await GET(makeRequest({ url: 'http://localhost/api/admin/clients?includeArchived=1' }));

    expect(hoisted.listClients).toHaveBeenCalledWith(
      { includeArchived: true },
      { actorRole: 'OWNER' }
    );
  });
});

describe('POST /api/admin/clients', () => {
  it('returns 401 when there is no valid session and never calls the service', async () => {
    hoisted.requireOwnerOrEmployee.mockRejectedValue(
      Object.assign(new Error('Not authenticated'), { statusCode: 401 })
    );

    const response = await POST(makeRequest({ body: { name: 'לקוח דמו א׳' } }));

    expect(response.status).toBe(401);
    expect(hoisted.createClient).not.toHaveBeenCalled();
  });

  it('returns 400 with the Hebrew invalid-body message for unparseable JSON', async () => {
    hoisted.requireOwnerOrEmployee.mockResolvedValue({ userId: 'emp-1', role: 'EMPLOYEE' });

    const response = await POST(makeRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe(he.clients.errors.invalidBody);
    expect(hoisted.createClient).not.toHaveBeenCalled();
  });

  it('passes Hebrew validation errors through untouched (fieldErrors + code)', async () => {
    hoisted.requireOwnerOrEmployee.mockResolvedValue({ userId: 'emp-1', role: 'EMPLOYEE' });
    hoisted.createClient.mockRejectedValue(
      Object.assign(new Error(he.clients.errors.validationSummary), {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        fieldErrors: { name: he.clients.errors.clientNameRequired },
      })
    );

    const response = await POST(makeRequest({ body: { name: '' } }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe(he.clients.errors.validationSummary);
    expect(body.fieldErrors).toEqual({ name: he.clients.errors.clientNameRequired });
  });

  it('passes the duplicate-name Hebrew 409 through untouched', async () => {
    hoisted.requireOwnerOrEmployee.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });
    hoisted.createClient.mockRejectedValue(
      Object.assign(new Error(he.clients.errors.clientNameTaken), {
        statusCode: 409,
        code: 'CLIENT_NAME_CONFLICT',
      })
    );

    const response = await POST(makeRequest({ body: { name: 'לקוח דמו א׳' } }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe(he.clients.errors.clientNameTaken);
  });

  it('creates for an EMPLOYEE session with the explicit field pick and actor context', async () => {
    hoisted.requireOwnerOrEmployee.mockResolvedValue({ userId: 'emp-1', role: 'EMPLOYEE' });
    hoisted.createClient.mockResolvedValue({ id: 'client-1', name: 'לקוח דמו א׳' });

    const response = await POST(
      makeRequest({
        body: { name: 'לקוח דמו א׳', notes: 'הערת דמו', status: 'SMUGGLED' },
      })
    );

    expect(response.status).toBe(201);
    const [fields, ctx] = hoisted.createClient.mock.calls[0];
    expect(fields).toEqual({
      name: 'לקוח דמו א׳',
      contactName: undefined,
      contactEmail: undefined,
      contactPhone: undefined,
      notes: 'הערת דמו',
    });
    expect(ctx).toMatchObject({ actorId: 'emp-1', actorRole: 'EMPLOYEE' });
    expect(ctx.correlationId).toBeTruthy();
  });
});
