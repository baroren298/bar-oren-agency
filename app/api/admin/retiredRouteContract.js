/*
 * Website CMS Focus Cleanup — SINGLE SOURCE OF TRUTH for the retired
 * Clients & Brands API route contract.
 *
 * Every retired route must return one uniform response and must reach no
 * authentication, authorization, body parsing, validation, or service code
 * first. The assertions that DEFINE that contract live here, once, and are
 * reused by every retired-route test (the per-route colocated files and the
 * cross-cutting suite) so the contract can never drift between them.
 *
 * This is a test-support module: it is imported only by *.test.js files,
 * never by any route or page, so it is never part of the production build.
 */
import { expect, vi } from 'vitest';

// The one payload every retired route returns (matches the shared gate,
// lib/admin/retired-modules.js).
export const RETIRED_BODY = Object.freeze({ error: 'Not found' });

// Business data, validation/authorization detail, or record-existence
// signals that must NEVER appear in a retired response.
export const FORBIDDEN_KEYS = Object.freeze([
  'client',
  'clients',
  'brand',
  'brands',
  'id',
  'contactName',
  'contactEmail',
  'contactPhone',
  'notes',
  'fieldErrors',
  'code',
  'status',
  'role',
]);

// A request whose json() is a spy, so a test can prove body parsing never
// ran (the gate returns before the body is read).
export function makeRetiredRequest(body = { name: 'should-not-be-read' }) {
  return {
    url: 'http://localhost/api/admin?includeArchived=1',
    json: vi.fn(async () => body),
    headers: { get: () => null },
  };
}

export function makeRetiredCtx(id = 'should-not-be-read') {
  return { params: Promise.resolve({ id }) };
}

// Assert a handler response satisfies the retired contract. When `req` came
// from makeRetiredRequest, also asserts its body was never parsed.
export async function expectRetiredResponse(res, { req } = {}) {
  expect(res.status).toBe(404);

  const body = await res.json();
  expect(body).toEqual(RETIRED_BODY);
  expect(Object.keys(body)).toEqual(['error']);
  for (const key of FORBIDDEN_KEYS) {
    expect(body).not.toHaveProperty(key);
  }

  if (req && req.json && typeof req.json.mock === 'object') {
    expect(req.json).not.toHaveBeenCalled();
  }

  return body;
}
