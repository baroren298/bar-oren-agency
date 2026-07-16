/*
 * sessionsState tests — Sprint 3c (Session Management UI).
 *
 * Pure logic, no React/DOM: covers the reducer transitions, the
 * current-session revoke guard, duplicate-click protection, the
 * revoke/revoke-all request shape, and the HTTP-status -> semantic error
 * code mapping (never the raw response body — see sessionsState.js).
 */
import { describe, it, expect } from 'vitest';
import {
  initialSessionsState,
  sessionsReducer,
  canRevokeSession,
  dialogTargetSessionId,
  shouldIgnoreConfirm,
  resolveRevokeRequest,
  mapListErrorCode,
  mapActionErrorCode,
} from './sessionsState';

describe('sessionsReducer — fetch lifecycle', () => {
  it('FETCH_START enters loading and clears any previous load error', () => {
    const state = sessionsReducer({ ...initialSessionsState, status: 'error', loadError: 'GENERIC' }, {
      type: 'FETCH_START',
    });
    expect(state.status).toBe('loading');
    expect(state.loadError).toBeNull();
  });

  it('FETCH_SUCCESS stores the sessions and clears loadError', () => {
    const sessions = [{ id: 's-1', createdAt: 'a', expiresAt: 'b', isCurrent: false }];
    const state = sessionsReducer(initialSessionsState, { type: 'FETCH_SUCCESS', sessions });
    expect(state.status).toBe('ready');
    expect(state.sessions).toBe(sessions);
    expect(state.loadError).toBeNull();
  });

  it('FETCH_ERROR clears the session list and stores a semantic code', () => {
    const state = sessionsReducer(initialSessionsState, { type: 'FETCH_ERROR', code: 'UNAUTHORIZED' });
    expect(state.status).toBe('error');
    expect(state.sessions).toEqual([]);
    expect(state.loadError).toBe('UNAUTHORIZED');
  });
});

describe('sessionsReducer — dialog lifecycle', () => {
  it('OPEN_REVOKE_ONE stores only the opaque sessionId as the dialog target', () => {
    const state = sessionsReducer(initialSessionsState, { type: 'OPEN_REVOKE_ONE', sessionId: 'sid-abc' });
    expect(state.dialog).toEqual({ type: 'one', sessionId: 'sid-abc' });
  });

  it('OPEN_REVOKE_ALL opens a revoke-all dialog with no session id', () => {
    const state = sessionsReducer(initialSessionsState, { type: 'OPEN_REVOKE_ALL' });
    expect(state.dialog).toEqual({ type: 'all' });
  });

  it('CLOSE_DIALOG clears the dialog and any action error', () => {
    const open = { ...initialSessionsState, dialog: { type: 'all' }, actionError: 'GENERIC' };
    const state = sessionsReducer(open, { type: 'CLOSE_DIALOG' });
    expect(state.dialog).toBeNull();
    expect(state.actionError).toBeNull();
  });

  it('CLOSE_DIALOG is ignored while a confirm is in flight', () => {
    const confirming = { ...initialSessionsState, dialog: { type: 'all' }, confirming: true };
    const state = sessionsReducer(confirming, { type: 'CLOSE_DIALOG' });
    expect(state).toBe(confirming);
  });
});

describe('sessionsReducer — duplicate-click protection', () => {
  it('a second CONFIRM_START while confirming is a no-op (same state back)', () => {
    const first = sessionsReducer(initialSessionsState, { type: 'CONFIRM_START' });
    expect(first.confirming).toBe(true);

    const second = sessionsReducer(first, { type: 'CONFIRM_START' });
    expect(second).toBe(first); // no new transition — the duplicate click changed nothing
  });

  it('OPEN_REVOKE_ONE / OPEN_REVOKE_ALL are ignored while confirming', () => {
    const confirming = { ...initialSessionsState, confirming: true, dialog: { type: 'one', sessionId: 'sid-1' } };
    expect(sessionsReducer(confirming, { type: 'OPEN_REVOKE_ALL' })).toBe(confirming);
    expect(sessionsReducer(confirming, { type: 'OPEN_REVOKE_ONE', sessionId: 'sid-2' })).toBe(confirming);
  });

  it('shouldIgnoreConfirm reflects the in-flight guard a caller must check before firing a request', () => {
    expect(shouldIgnoreConfirm(initialSessionsState)).toBe(false);
    expect(shouldIgnoreConfirm({ ...initialSessionsState, confirming: true })).toBe(true);
  });

  it('CONFIRM_ERROR ends the in-flight state and records a semantic code', () => {
    const confirming = sessionsReducer(initialSessionsState, { type: 'CONFIRM_START' });
    const errored = sessionsReducer(confirming, { type: 'CONFIRM_ERROR', code: 'SESSION_GONE' });
    expect(errored.confirming).toBe(false);
    expect(errored.actionError).toBe('SESSION_GONE');
  });

  it('REVOKE_DONE closes the dialog and clears confirming/actionError', () => {
    const confirming = { ...initialSessionsState, confirming: true, dialog: { type: 'one', sessionId: 'sid-1' } };
    const done = sessionsReducer(confirming, { type: 'REVOKE_DONE' });
    expect(done.confirming).toBe(false);
    expect(done.dialog).toBeNull();
    expect(done.actionError).toBeNull();
  });
});

describe('canRevokeSession', () => {
  it('the current session cannot be single-revoked', () => {
    expect(canRevokeSession({ id: 's-1', isCurrent: true })).toBe(false);
  });

  it('any other session can be single-revoked', () => {
    expect(canRevokeSession({ id: 's-2', isCurrent: false })).toBe(true);
  });

  it('handles a missing session gracefully', () => {
    expect(canRevokeSession(undefined)).toBe(false);
  });
});

describe('dialogTargetSessionId', () => {
  it('returns the sessionId for a revoke-one dialog', () => {
    const state = { ...initialSessionsState, dialog: { type: 'one', sessionId: 'sid-9' } };
    expect(dialogTargetSessionId(state)).toBe('sid-9');
  });

  it('returns null for a revoke-all dialog or no dialog', () => {
    expect(dialogTargetSessionId({ ...initialSessionsState, dialog: { type: 'all' } })).toBeNull();
    expect(dialogTargetSessionId(initialSessionsState)).toBeNull();
  });
});

describe('resolveRevokeRequest', () => {
  const userId = 'user-1';

  it('builds the revoke-all request with no session id anywhere in the URL', () => {
    const req = resolveRevokeRequest(userId, { type: 'all' });
    expect(req).toEqual({ url: `/api/admin/users/${userId}/sessions/revoke-all`, method: 'POST' });
  });

  it('builds the revoke-one request using only the opaque sessionId as the URL param', () => {
    const req = resolveRevokeRequest(userId, { type: 'one', sessionId: 'sid-42' });
    expect(req).toEqual({ url: `/api/admin/users/${userId}/sessions/sid-42/revoke`, method: 'POST' });
  });

  it('returns null when there is no dialog target', () => {
    expect(resolveRevokeRequest(userId, null)).toBeNull();
    expect(resolveRevokeRequest(userId, { type: 'one', sessionId: null })).toBeNull();
  });
});

describe('mapListErrorCode', () => {
  it('maps 401/403 to their semantic codes and everything else to GENERIC', () => {
    expect(mapListErrorCode(401)).toBe('UNAUTHORIZED');
    expect(mapListErrorCode(403)).toBe('FORBIDDEN');
    expect(mapListErrorCode(500)).toBe('GENERIC');
    expect(mapListErrorCode(undefined)).toBe('GENERIC');
  });
});

describe('mapActionErrorCode', () => {
  it('maps the 409 CANNOT_REVOKE_CURRENT_SESSION case distinctly', () => {
    expect(mapActionErrorCode(409, 'CANNOT_REVOKE_CURRENT_SESSION')).toBe('CANNOT_REVOKE_CURRENT');
  });

  it('maps a bare 409 (unexpected api code) to GENERIC, not a false "current session" message', () => {
    expect(mapActionErrorCode(409, undefined)).toBe('GENERIC');
  });

  it('maps 404 to SESSION_GONE (idempotent — already revoked/expired/foreign)', () => {
    expect(mapActionErrorCode(404)).toBe('SESSION_GONE');
  });

  it('maps 401/403 like the list endpoint', () => {
    expect(mapActionErrorCode(401)).toBe('UNAUTHORIZED');
    expect(mapActionErrorCode(403)).toBe('FORBIDDEN');
  });

  it('falls back to GENERIC for anything else', () => {
    expect(mapActionErrorCode(500)).toBe('GENERIC');
  });
});
