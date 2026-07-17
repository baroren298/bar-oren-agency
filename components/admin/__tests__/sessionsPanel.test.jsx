/*
 * SessionsPanel tests — Sprint 3c (Session Management UI).
 *
 * Same react-dom/server renderToString harness as globalEditMode.test.jsx
 * / podcastImageUpload.test.jsx (this repo's vitest setup has no jsdom /
 * @testing-library, so interaction is covered at the pure-logic level in
 * lib/admin/ui/sessionsState.test.js; this file only asserts what a given
 * prop combination renders). A fetch spy asserts the presentational
 * component itself never performs network calls — all fetching lives in
 * SessionsSection.jsx, never here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { he } from '@/lib/admin/i18n/he';

import SessionsPanel from '@/components/admin/SessionsPanel';

const COPY = he.users.detail.sessions;
const ERRORS = he.users.errors;

const SECRET_SESSION_ID = 'SID-TEST-9f3e1c77-should-never-render';

const currentSession = {
  id: SECRET_SESSION_ID,
  createdAt: '2026-07-10T08:00:00.000Z',
  expiresAt: '2026-07-17T08:00:00.000Z',
  isCurrent: true,
};

const otherSession = {
  id: 'sid-other-1',
  createdAt: '2026-07-11T09:00:00.000Z',
  expiresAt: '2026-07-18T09:00:00.000Z',
  isCurrent: false,
};

function baseProps(overrides = {}) {
  return {
    status: 'ready',
    sessions: [],
    loadError: null,
    isSelfView: true,
    dialog: null,
    confirming: false,
    actionError: null,
    onRequestRevokeOne: () => {},
    onRequestRevokeAll: () => {},
    onConfirm: () => {},
    onCancel: () => {},
    ...overrides,
  };
}

function render(props) {
  return renderToString(h(SessionsPanel, baseProps(props)));
}

let fetchSpy;

beforeEach(() => {
  fetchSpy = vi.fn(() => {
    throw new Error('SessionsPanel must never call fetch — it is presentational only');
  });
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SessionsPanel — section identity', () => {
  it('renders the "התחברויות" card title and description, no network on render', () => {
    const html = render({});
    expect(html).toContain(he.users.detail.sections.sessions);
    expect(html).toContain(COPY.description);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('SessionsPanel — loading / empty / error states', () => {
  it('loading state shows the loading copy and no list', () => {
    const html = render({ status: 'loading', sessions: [] });
    expect(html).toContain(COPY.loading);
    expect(html).not.toContain('<ul');
  });

  it('empty state (ready, zero sessions) shows the empty copy and no revoke-all button', () => {
    const html = render({ status: 'ready', sessions: [] });
    expect(html).toContain(COPY.empty);
    expect(html).not.toContain(COPY.revokeAllSelf);
    expect(html).not.toContain(COPY.revokeAllOther);
  });

  it('error state maps UNAUTHORIZED to the generic not-authenticated copy', () => {
    const html = render({ status: 'error', loadError: 'UNAUTHORIZED' });
    expect(html).toContain(ERRORS.notAuthenticated);
  });

  it('error state maps an unrecognized code to the generic server-error copy (never a raw message)', () => {
    const html = render({ status: 'error', loadError: 'GENERIC' });
    expect(html).toContain(ERRORS.serverError);
  });
});

describe('SessionsPanel — active session list', () => {
  it('renders both sessions with their created/expiry dates', () => {
    const html = render({ sessions: [currentSession, otherSession] });
    expect(html).toContain(COPY.fields.createdAt);
    expect(html).toContain(COPY.fields.expiresAt);
  });

  it('shows the current-session badge exactly once, with visible text (not color-only)', () => {
    const html = render({ sessions: [currentSession, otherSession] });
    // Match the StatusBadge element itself (exact text content inside a
    // <span>), not a raw substring count — COPY.currentHint's explanatory
    // sentence for the current row legitimately contains the same words
    // ("...לנתק את ההתחברות הנוכחית דרך מסך זה...") without that being a
    // second rendered badge.
    const badgeElementMatches = html.match(new RegExp(`<span[^>]*>${COPY.currentBadge}</span>`, 'g')) || [];
    expect(badgeElementMatches).toHaveLength(1);
  });

  it('the current session cannot be single-revoked: no revoke button for it, an explanatory note instead', () => {
    const html = render({ sessions: [currentSession] });
    expect(html).not.toContain(COPY.revokeOne);
    expect(html).toContain(COPY.currentHint);
  });

  it('a non-current session gets a "נתק התחברות" button with an accessible label, no id in it', () => {
    const html = render({ sessions: [otherSession] });
    expect(html).toContain(COPY.revokeOne);
    expect(html).toMatch(/aria-label="[^"]*נתק התחברות[^"]*"/);
  });

  it('mixed list: exactly one revoke button (for the non-current row), one explanatory note (for the current row)', () => {
    const html = render({ sessions: [currentSession, otherSession] });
    // Count actual <button>...</button> elements whose visible text is
    // COPY.revokeOne — not a plain substring count, since the same text
    // also appears inside that button's aria-label.
    const revokeButtonMatches = html.match(new RegExp(`>${COPY.revokeOne}</button>`, 'g')) || [];
    expect(revokeButtonMatches).toHaveLength(1);
    expect(html).toContain(COPY.currentHint);
  });
});

describe('SessionsPanel — no session id ever visibly rendered', () => {
  it('the raw session id never appears in the list, badges, notes, or aria-labels', () => {
    const html = render({ sessions: [currentSession, otherSession] });
    expect(html).not.toContain(SECRET_SESSION_ID);
    expect(html).not.toContain(otherSession.id);
  });

  it('the raw session id never appears when a revoke-one dialog targets it', () => {
    const html = render({
      sessions: [otherSession],
      dialog: { type: 'one', sessionId: otherSession.id },
    });
    expect(html).not.toContain(otherSession.id);
  });
});

describe('SessionsPanel — revoke-all label depends on self vs. other user', () => {
  it('viewing your own user shows "נתק את כל שאר ההתחברויות"', () => {
    const html = render({ sessions: [otherSession], isSelfView: true });
    expect(html).toContain(COPY.revokeAllSelf);
    expect(html).not.toContain(COPY.revokeAllOther);
  });

  it('viewing another user shows "נתק את כל ההתחברויות"', () => {
    const html = render({ sessions: [otherSession], isSelfView: false });
    expect(html).toContain(COPY.revokeAllOther);
    expect(html).not.toContain(COPY.revokeAllSelf);
  });
});

describe('SessionsPanel — confirmation dialogs', () => {
  it('no dialog by default — no dialog role present', () => {
    const html = render({ sessions: [otherSession] });
    expect(html).not.toMatch(/role="dialog"/);
  });

  it('revoke-one dialog: accessible dialog role + generic single-session copy', () => {
    const html = render({ sessions: [otherSession], dialog: { type: 'one', sessionId: otherSession.id } });
    expect(html).toMatch(/role="dialog"/);
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain(COPY.confirmOne.title);
    expect(html).toContain(COPY.confirmOne.body);
  });

  it('revoke-all dialog for self clearly preserves the current session', () => {
    const html = render({ sessions: [otherSession], isSelfView: true, dialog: { type: 'all' } });
    expect(html).toContain(COPY.confirmAllSelf.title);
    expect(html).toContain(COPY.confirmAllSelf.body);
    expect(html).not.toContain(COPY.confirmAllOther.body);
  });

  it('revoke-all dialog for another user does not claim to preserve anything', () => {
    const html = render({ sessions: [otherSession], isSelfView: false, dialog: { type: 'all' } });
    expect(html).toContain(COPY.confirmAllOther.title);
    expect(html).toContain(COPY.confirmAllOther.body);
    expect(html).not.toContain(COPY.confirmAllSelf.body);
  });

  it('a dialog action error is shown as generic copy (mapped from a semantic code)', () => {
    const html = render({
      sessions: [otherSession],
      dialog: { type: 'one', sessionId: otherSession.id },
      actionError: 'CANNOT_REVOKE_CURRENT',
    });
    expect(html).toContain(COPY.errors.cannotRevokeCurrent);
  });
});

describe('SessionsPanel — pending/duplicate-click accessible state', () => {
  it('while confirming, both dialog buttons are disabled and the confirming label replaces the confirm label', () => {
    const html = render({
      sessions: [otherSession],
      dialog: { type: 'one', sessionId: otherSession.id },
      confirming: true,
    });
    const disabledButtonCount = (html.match(/<button[^>]*disabled[^>]*>/g) || []).length;
    expect(disabledButtonCount).toBeGreaterThanOrEqual(2); // cancel + confirm
    expect(html).toContain(COPY.revokingOne);
  });

  it('while confirming, the per-row revoke button is also disabled (no second request can start from the list)', () => {
    const html = render({ sessions: [otherSession], confirming: true });
    expect(html).toMatch(new RegExp(`<button[^>]*disabled[^>]*>${COPY.revokeOne}</button>`));
  });
});
