/*
 * GET/POST /api/admin/users — route-level coverage (Sprint 3: Users UI).
 *
 * requireOwner and userService are both mocked — this file verifies the
 * route wires them together correctly (auth gate, request parsing, status
 * code mapping) and never that either dependency's own logic is correct
 * (that's userService.test.js's job).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  listUsers: vi.fn(),
  createEmployee: vi.fn(),
}));

vi.mock('@/lib/admin/auth/authorize', () => ({
  requireOwner: hoisted.requireOwner,
}));

vi.mock('@/lib/admin/userService', () => ({
  userService: {
    listUsers: hoisted.listUsers,
    createEmployee: hoisted.createEmployee,
  },
}));

import { GET, POST } from './route';

function makeRequest(body) {
  return {
    json: async () => body,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/users', () => {
  it('returns 401 when there is no valid session', async () => {
    hoisted.requireOwner.mockRejectedValue(Object.assign(new Error('Not authenticated'), { statusCode: 401 }));

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    expect(hoisted.listUsers).not.toHaveBeenCalled();
  });

  it('returns 403 when the session is valid but not an Owner', async () => {
    hoisted.requireOwner.mockRejectedValue(Object.assign(new Error('Forbidden'), { statusCode: 403 }));

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Only the Owner may manage users.');
    expect(hoisted.listUsers).not.toHaveBeenCalled();
  });

  it('returns the user list for an authenticated Owner', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });
    hoisted.listUsers.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ users: [{ id: 'user-1' }, { id: 'user-2' }] });
    expect(hoisted.listUsers).toHaveBeenCalledWith({ actorRole: 'OWNER' });
  });
});

describe('POST /api/admin/users', () => {
  it('returns 401 when there is no valid session', async () => {
    hoisted.requireOwner.mockRejectedValue(Object.assign(new Error('Not authenticated'), { statusCode: 401 }));

    const response = await POST(makeRequest({}));

    expect(response.status).toBe(401);
    expect(hoisted.createEmployee).not.toHaveBeenCalled();
  });

  it('returns 400 with fieldErrors when userService.createEmployee rejects validation', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });
    hoisted.createEmployee.mockRejectedValue(
      Object.assign(new Error('Please fix the highlighted fields.'), {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        fieldErrors: { email: 'A valid email address is required.' },
      })
    );

    const response = await POST(makeRequest({ email: 'bad', displayName: '', temporaryPassword: '123' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors).toEqual({ email: 'A valid email address is required.' });
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('creates an employee and returns 201 on success', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });
    hoisted.createEmployee.mockResolvedValue({ id: 'new-user', role: 'EMPLOYEE' });

    const response = await POST(
      makeRequest({ email: 'new@example.com', displayName: 'Noa', temporaryPassword: 'temp12345' })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({ user: { id: 'new-user', role: 'EMPLOYEE' } });
    expect(hoisted.createEmployee).toHaveBeenCalledWith(
      { email: 'new@example.com', displayName: 'Noa', temporaryPassword: 'temp12345' },
      { actorRole: 'OWNER' }
    );
  });

  it('returns 400 for an unparsable request body', async () => {
    hoisted.requireOwner.mockResolvedValue({ userId: 'owner-1', role: 'OWNER' });

    const response = await POST({
      json: async () => {
        throw new Error('bad json');
      },
    });

    expect(response.status).toBe(400);
    expect(hoisted.createEmployee).not.toHaveBeenCalled();
  });
});
