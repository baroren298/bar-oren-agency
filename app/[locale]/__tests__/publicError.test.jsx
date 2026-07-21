/*
 * CMS Error & Loading Boundaries sprint — app/[locale]/error.jsx coverage.
 *
 * error.jsx receives no route params, only {error, reset} (Next.js's own
 * contract), so locale/direction is derived from usePathname() — same
 * pattern already used by app/[locale]/not-found.jsx. usePathname is
 * mocked per-test via a vi.fn() so each test can point it at a different
 * path without a real Next.js router.
 *
 * This component uses a real `useEffect` (to set document.title), which
 * means — unlike AdminError (no hooks) — it can't be invoked directly as a
 * plain function outside of a render pass (that would throw React's
 * "invalid hook call"). renderToString is used for every copy/attribute
 * assertion below. The one thing renderToString can't prove — that
 * clicking the retry button truly calls `reset` — is instead checked as a
 * source-level assertion (same technique app/admin/__tests__/
 * idleTimeoutScope.test.js already uses for wiring that can't be clicked
 * in this repo's plain-vitest, no-jsdom setup).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { strings } from '@/data/i18n/strings';

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(() => '/'),
}));

vi.mock('next/navigation', () => ({
  usePathname: mocks.usePathname,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }) => h('a', { href, className }, children),
}));

import PublicError from '../error';

function renderAt(pathname, props = {}) {
  mocks.usePathname.mockReturnValue(pathname);
  return renderToString(h(PublicError, { error: null, reset: () => {}, ...props }));
}

beforeEach(() => {
  mocks.usePathname.mockReset();
});

describe('PublicError — Hebrew (default locale) paths', () => {
  it.each(['/', '/talent', '/contact'])('renders Hebrew copy for %s', (pathname) => {
    const html = renderAt(pathname);
    expect(html).toContain(strings.he.error.title);
    expect(html).toContain(strings.he.error.body);
    expect(html).toContain(strings.he.error.retry);
    // Reuses the existing 404 home-link copy rather than a duplicate string.
    expect(html).toContain(strings.he.notFound.link);
  });

  it('renders dir="rtl" for Hebrew paths', () => {
    const html = renderAt('/talent');
    expect(html).toMatch(/dir="rtl"/);
  });
});

describe('PublicError — English (/en) paths', () => {
  it.each(['/en', '/en/talent', '/en/contact'])('renders English copy for %s', (pathname) => {
    const html = renderAt(pathname);
    expect(html).toContain(strings.en.error.title);
    expect(html).toContain(strings.en.error.body);
    expect(html).toContain(strings.en.error.retry);
    expect(html).toContain(strings.en.notFound.link);
    // And not the Hebrew strings.
    expect(html).not.toContain(strings.he.error.title);
  });

  it('renders dir="ltr" for /en paths', () => {
    const html = renderAt('/en/talent');
    expect(html).toMatch(/dir="ltr"/);
  });
});

describe('PublicError — retry wiring (source-level check)', () => {
  it('the retry button\'s onClick is wired directly to the `reset` prop', () => {
    const source = readFileSync(path.resolve(__dirname, '..', 'error.jsx'), 'utf8');
    expect(source).toMatch(/onClick=\{reset\}/);
  });
});

describe('PublicError — never exposes raw error detail', () => {
  it('renders nothing derived from a supplied error.message, stack, or digest', () => {
    const sensitiveError = new Error('ENOTFOUND internal-db-host.prod.svc.cluster.local');
    sensitiveError.digest = 'DIGEST_9876543210';
    mocks.usePathname.mockReturnValue('/talent');
    const html = renderToString(h(PublicError, { error: sensitiveError, reset: () => {} }));
    expect(html).not.toContain('internal-db-host');
    expect(html).not.toContain('ENOTFOUND');
    expect(html).not.toContain('DIGEST_9876543210');
  });
});
