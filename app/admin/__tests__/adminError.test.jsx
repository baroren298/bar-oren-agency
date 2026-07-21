/*
 * CMS Error & Loading Boundaries sprint — app/admin/error.jsx coverage.
 *
 * AdminError has no hooks (it only reads `he` copy and forwards `reset`),
 * so — unlike most Client Components in this repo — it can be invoked
 * directly as a plain function to get back its React element tree, without
 * needing a DOM/browser test dependency this repo doesn't have (see
 * socialLinksEditorRemove.test.jsx's header comment for the same
 * reasoning applied to a pure function instead of a component). That lets
 * the retry-button test assert the *actual* onClick reference is `reset`,
 * not just that some markup exists — stronger than a renderToString/regex
 * check for this one behavior.
 *
 * Copy and structural checks below still use renderToString, since that's
 * the simplest way to inspect rendered text/attributes across this file's
 * whole tree.
 */
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { he } from '@/lib/admin/i18n/he';

import AdminError from '../error';
import PrimaryButton from '@/components/admin/PrimaryButton';

function findAll(node, predicate, results = []) {
  if (node === null || node === undefined || typeof node === 'string' || typeof node === 'number') {
    return results;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, predicate, results));
    return results;
  }
  if (predicate(node)) results.push(node);
  if (node.props && node.props.children !== undefined) {
    findAll(node.props.children, predicate, results);
  }
  return results;
}

describe('AdminError — Hebrew copy + structure', () => {
  it('renders the exact required Hebrew title, body, retry, and back-link copy', () => {
    const html = renderToString(h(AdminError, { reset: () => {} }));
    expect(html).toContain(he.error.title);
    expect(html).toContain(he.error.body);
    expect(html).toContain(he.error.retry);
    expect(html).toContain(he.error.back);
  });

  it('renders dir="rtl" and lang="he" — no assumption of an ambient locale context', () => {
    const html = renderToString(h(AdminError, { reset: () => {} }));
    expect(html).toMatch(/dir="rtl"/);
    expect(html).toMatch(/lang="he"/);
  });

  it('renders a link back to /admin (works with no sidebar/nav present)', () => {
    const html = renderToString(h(AdminError, { reset: () => {} }));
    expect(html).toMatch(/href="\/admin"/);
  });
});

describe('AdminError — retry wiring', () => {
  it('the PrimaryButton (retry) onClick is exactly the `reset` function passed in, not a wrapper', () => {
    const resetSpy = vi.fn();
    const tree = AdminError({ reset: resetSpy });
    const buttons = findAll(tree, (node) => node.type === PrimaryButton);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].props.onClick).toBe(resetSpy);

    // Calling it (as Next.js would on click) actually invokes reset().
    buttons[0].props.onClick();
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });
});

describe('AdminError — never exposes raw error detail', () => {
  it('renders nothing derived from a supplied error.message, even with a sensitive-looking message', () => {
    const sensitiveError = new Error(
      'connect ECONNREFUSED postgres://admin:s3cr3t@db.internal:5432/prod'
    );
    sensitiveError.digest = 'DIGEST_1234567890';

    const html = renderToString(h(AdminError, { error: sensitiveError, reset: () => {} }));

    expect(html).not.toContain('s3cr3t');
    expect(html).not.toContain('postgres://');
    expect(html).not.toContain('ECONNREFUSED');
    expect(html).not.toContain('DIGEST_1234567890');
    expect(html).not.toContain(sensitiveError.stack ?? '__no_stack__');
  });

  it('only ever renders the four fixed copy strings plus the /admin link — nothing else user- or error-supplied', () => {
    const html = renderToString(h(AdminError, { error: new Error('anything'), reset: () => {} }));
    // Sanity: the fixed copy is present...
    [he.error.title, he.error.body, he.error.retry, he.error.back, he.shell.brand].forEach((copy) => {
      expect(html).toContain(copy);
    });
    // ...and the literal word "Error" (as a thrown JS Error's default
    // toString/message prefix) never leaks into the markup.
    expect(html).not.toMatch(/\bError\b/);
  });
});
