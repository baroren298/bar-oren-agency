/*
 * CMS Error & Loading Boundaries sprint — app/admin/loading.jsx coverage.
 *
 * Server Component, no hooks — rendered via renderToString same as the
 * other markup checks in this suite.
 */
import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { he } from '@/lib/admin/i18n/he';

import AdminLoading from '../loading';

describe('AdminLoading — accessibility', () => {
  it('exposes role="status" and aria-live="polite" on the accessible label', () => {
    const html = renderToString(h(AdminLoading, {}));
    expect(html).toMatch(/role="status"/);
    expect(html).toMatch(/aria-live="polite"/);
  });

  it('renders the visually-hidden Hebrew "טוען…" label', () => {
    const html = renderToString(h(AdminLoading, {}));
    expect(html).toContain(he.loading.label);
  });

  it('the spinner graphic is aria-hidden (not double-announced alongside the status label)', () => {
    const html = renderToString(h(AdminLoading, {}));
    expect(html).toMatch(/aria-hidden="true"/);
  });

  it('renders dir="rtl" and lang="he", matching the admin tree', () => {
    const html = renderToString(h(AdminLoading, {}));
    expect(html).toMatch(/dir="rtl"/);
    expect(html).toMatch(/lang="he"/);
  });
});

describe('AdminLoading — no fabricated content', () => {
  it('renders nothing beyond the spinner + status label — no talent/user names, table rows, or fabricated counts', () => {
    const html = renderToString(h(AdminLoading, {}));
    // The previous version of this test banned any digit anywhere in the
    // raw HTML, which false-failed: CSS Modules' generated class-name
    // hashes (e.g. class="_page_1a2b3") legitimately contain digits and
    // show up in markup/attributes, not as visible content. Stripping tags
    // and comparing the remaining text content directly is the accurate
    // check — it proves the *only* thing a user/screen-reader ever sees is
    // the status label itself, with nothing else (fabricated or not)
    // rendered alongside it.
    const textContent = html.replace(/<[^>]*>/g, '').trim();
    expect(textContent).toBe(he.loading.label);
    // No other admin copy blocks accidentally pulled in.
    expect(html).not.toContain(he.error.title);
    expect(html).not.toContain(he.nav.dashboard);
  });
});
