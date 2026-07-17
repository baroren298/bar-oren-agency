/*
 * IdleWarningDialog tests — Sprint 4 (Admin Idle Timeout & Automatic
 * Logout).
 *
 * Same react-dom/server renderToString harness as sessionsPanel.test.jsx
 * (this repo's vitest setup has no jsdom/@testing-library — see that file's
 * header comment): renderToString doesn't run effects, so focus-management
 * behavior (move focus in on mount, restore on unmount) is NOT exercised
 * here — that's a browser-only concern documented in the component itself.
 * This file only asserts static markup: copy, accessible structure, and
 * that the component never calls fetch (all network logic lives in
 * AdminIdleTimeoutManager, never in this presentational component).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { he } from '@/lib/admin/i18n/he';

import IdleWarningDialog from '@/components/admin/IdleWarningDialog';

const COPY = he.idleTimeout;

function render(props) {
  return renderToString(
    h(IdleWarningDialog, { countdownSeconds: 60, onStay: () => {}, onLogoutNow: () => {}, ...props })
  );
}

let fetchSpy;

beforeEach(() => {
  fetchSpy = vi.fn(() => {
    throw new Error('IdleWarningDialog must never call fetch — it is presentational only');
  });
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('IdleWarningDialog — copy + structure', () => {
  it('renders the Hebrew security-warning title and body, no network on render', () => {
    const html = render({});
    expect(html).toContain(COPY.title);
    expect(html).toContain(COPY.body);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renders the countdown number and unit', () => {
    const html = render({ countdownSeconds: 42 });
    expect(html).toContain('42');
    expect(html).toContain(COPY.countdownUnit);
  });

  it('renders both action buttons with the exact required Hebrew labels', () => {
    const html = render({});
    expect(html).toContain(COPY.stayLoggedIn);
    expect(html).toContain(COPY.logoutNow);
  });
});

describe('IdleWarningDialog — accessibility', () => {
  it('uses an accessible alertdialog with aria-modal, labelled by the title and described by the static body', () => {
    const html = render({});
    expect(html).toMatch(/role="alertdialog"/);
    expect(html).toContain('aria-modal="true"');
    expect(html).toMatch(/aria-labelledby="idle-warning-title"/);
    expect(html).toMatch(/aria-describedby="idle-warning-body"/);
  });

  it('the ticking countdown number is not inside an aria-live region (avoids per-second announcements)', () => {
    const html = render({ countdownSeconds: 59 });
    expect(html).not.toMatch(/aria-live/);
  });

  it('the countdown text itself is not part of aria-describedby (only the static sentence is)', () => {
    const html = render({ countdownSeconds: 59 });
    // The described element (idle-warning-body) contains only the static
    // copy, never the countdown number concatenated into it.
    const describedMatch = html.match(/<p id="idle-warning-body"[^>]*>([^<]*)<\/p>/);
    expect(describedMatch).toBeTruthy();
    expect(describedMatch[1]).toBe(COPY.body);
  });
});

describe('IdleWarningDialog — no sensitive data ever rendered', () => {
  it('never renders anything resembling a session id, cookie, or token', () => {
    const html = render({});
    expect(html).not.toMatch(/sid[-_]|session[-_]?id|eyJ/i);
  });
});
