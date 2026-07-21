/*
 * CMS Error & Loading Boundaries sprint — app/[locale]/loading.jsx coverage.
 *
 * Same usePathname-mocking approach as publicError.test.jsx. This
 * component has no useEffect, only the usePathname hook (mocked to a plain
 * function), so it renders safely via renderToString like every other test
 * in this file.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { strings } from '@/data/i18n/strings';

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(() => '/'),
}));

vi.mock('next/navigation', () => ({
  usePathname: mocks.usePathname,
}));

import PublicLoading from '../loading';

beforeEach(() => {
  mocks.usePathname.mockReset();
});

describe('PublicLoading — accessibility', () => {
  it('exposes role="status" and aria-live="polite"', () => {
    mocks.usePathname.mockReturnValue('/talent');
    const html = renderToString(h(PublicLoading, {}));
    expect(html).toMatch(/role="status"/);
    expect(html).toMatch(/aria-live="polite"/);
  });

  it('the spinner graphic is aria-hidden, so it is not double-announced with the status label', () => {
    mocks.usePathname.mockReturnValue('/talent');
    const html = renderToString(h(PublicLoading, {}));
    expect(html).toMatch(/aria-hidden="true"/);
  });
});

describe('PublicLoading — locale-aware direction and label', () => {
  it('Hebrew paths: dir="rtl" and the Hebrew loading label', () => {
    mocks.usePathname.mockReturnValue('/talent');
    const html = renderToString(h(PublicLoading, {}));
    expect(html).toMatch(/dir="rtl"/);
    expect(html).toContain(strings.he.loading);
  });

  it('/en paths: dir="ltr" and the English loading label', () => {
    mocks.usePathname.mockReturnValue('/en/talent');
    const html = renderToString(h(PublicLoading, {}));
    expect(html).toMatch(/dir="ltr"/);
    expect(html).toContain(strings.en.loading);
    expect(html).not.toContain(strings.he.loading);
  });
});

describe('PublicLoading — no fabricated content', () => {
  it('renders only the spinner + status label — no talent names, cards, or counts', () => {
    mocks.usePathname.mockReturnValue('/talent');
    const html = renderToString(h(PublicLoading, {}));
    // Same fix as adminLoading.test.jsx: banning digits anywhere in the raw
    // HTML false-failed on CSS Modules' generated class-name hashes (e.g.
    // class="_page_1a2b3"), which legitimately contain digits in markup,
    // not in visible content. Stripping tags and comparing the remaining
    // text content directly proves the only thing rendered is the status
    // label itself.
    const textContent = html.replace(/<[^>]*>/g, '').trim();
    expect(textContent).toBe(strings.he.loading);
    expect(html).not.toContain(strings.he.error.title);
  });
});
