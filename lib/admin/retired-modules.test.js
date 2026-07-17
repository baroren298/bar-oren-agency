/*
 * Website CMS Focus Cleanup — shared module-retirement gate tests.
 *
 * Verifies the two centralized helpers every retired page/route funnels
 * through:
 *   - blockRetiredModulePage() → renders the standard 404 (throws notFound).
 *   - retiredModuleApiResponse() → a single generic 404 with NO business
 *     data and no record-existence signal.
 * next/navigation is mocked so notFound() throws a known sentinel rather
 * than relying on Next internals.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import {
  blockRetiredModulePage,
  retiredModuleApiResponse,
  RETIRED_MODULE_ERROR,
  RETIRED_MODULE_HTTP_STATUS,
} from './retired-modules';

describe('retired-modules gate', () => {
  it('blockRetiredModulePage() triggers a 404 (notFound) and never returns', () => {
    expect(() => blockRetiredModulePage()).toThrow('NEXT_NOT_FOUND');
  });

  it('retiredModuleApiResponse() returns a 404', async () => {
    const res = retiredModuleApiResponse();
    expect(res.status).toBe(404);
    expect(RETIRED_MODULE_HTTP_STATUS).toBe(404);
  });

  it('API response body is generic and exposes no business data', async () => {
    const res = retiredModuleApiResponse();
    const body = await res.json();

    // Only a generic error message — nothing else.
    expect(body).toEqual({ error: RETIRED_MODULE_ERROR });
    expect(Object.keys(body)).toEqual(['error']);

    // Explicitly assert none of the retired modules' data shapes leak.
    for (const forbidden of [
      'client',
      'clients',
      'brand',
      'brands',
      'contactName',
      'contactEmail',
      'contactPhone',
      'notes',
      'campaign',
      'campaigns',
      'fieldErrors',
      'code',
    ]) {
      expect(body).not.toHaveProperty(forbidden);
    }
  });

  it('gives the SAME response regardless of caller — no existence oracle', async () => {
    const a = await retiredModuleApiResponse().json();
    const b = await retiredModuleApiResponse().json();
    expect(a).toEqual(b);
    // "missing" and "forbidden" and "exists" are indistinguishable: the
    // body/status never varies by input because it takes no input.
    expect(retiredModuleApiResponse().status).toBe(retiredModuleApiResponse().status);
  });
});
