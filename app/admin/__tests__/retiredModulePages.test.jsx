/*
 * Website CMS Focus Cleanup — direct access to retired module PAGES is
 * blocked. Loading a Clients list, Client detail (with its nested Brands
 * UI), Campaigns list, or Campaign detail page renders the standard 404
 * (notFound) for everyone, BEFORE any session read or data access.
 *
 * Heavy dependencies are mocked via the repo's vi.hoisted() pattern (so the
 * mock objects exist before Vitest's hoisted vi.mock() factories reference
 * them). next/navigation.notFound is a known sentinel; getSessionUser and
 * clientService are spies asserted never to run.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
  usePathname: () => '/admin',
  cookies: async () => ({ get: () => undefined }),
  getSessionUser: vi.fn(async () => ({ userId: 'u1', role: 'OWNER' })),
  serviceMustNotRun: () => {
    throw new Error('service must not run on a retired page');
  },
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
  usePathname: mocks.usePathname,
}));

vi.mock('next/headers', () => ({ cookies: mocks.cookies }));

vi.mock('@/lib/admin/auth/authorize', () => ({ getSessionUser: mocks.getSessionUser }));

vi.mock('@/lib/admin/db', () => ({ isDatabaseConfigured: true, prisma: {} }));

vi.mock('@/lib/admin/clientService', () => ({
  clientService: new Proxy({}, { get: () => vi.fn(mocks.serviceMustNotRun) }),
}));

import ClientsPage from '../clients/page';
import ClientDetailPage from '../clients/[id]/page';
import CampaignsPage from '../campaigns/page';
import CampaignDetailPage from '../campaigns/[id]/page';

const withParams = { params: Promise.resolve({ id: 'should-not-be-read' }) };

const PAGES = [
  ['Clients list', () => ClientsPage()],
  ['Client detail (+ Brands UI)', () => ClientDetailPage(withParams)],
  ['Campaigns list', () => CampaignsPage()],
  ['Campaign detail', () => CampaignDetailPage(withParams)],
];

describe('retired module pages block direct access', () => {
  beforeEach(() => mocks.getSessionUser.mockClear());

  for (const [name, invoke] of PAGES) {
    it(`${name} → renders 404 before any auth/data access`, async () => {
      await expect(invoke()).rejects.toThrow('NEXT_NOT_FOUND');
      expect(mocks.getSessionUser).not.toHaveBeenCalled();
    });
  }
});
