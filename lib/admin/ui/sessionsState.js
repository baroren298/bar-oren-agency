/*
 * sessionsState — Sprint 3c (Session Management UI).
 *
 * Pure, framework-free state machine + helpers for the "התחברויות"
 * section of the User Details page (components/admin/SessionsSection.jsx
 * / SessionsPanel.jsx). Deliberately has zero React, zero fetch, and zero
 * DOM — same "extract the flow logic into a plain module so it's testable
 * without a DOM harness" pattern this repo already uses (see
 * lib/admin/podcast-image.js referenced from
 * components/admin/__tests__/podcastImageUpload.test.jsx's header
 * comment): this repo's vitest setup has no jsdom/@testing-library, only
 * react-dom/server's renderToString for presentational snapshots, so any
 * logic worth unit-testing has to live outside a React component.
 *
 * Session ids only ever flow through here as an opaque `sessionId` field
 * (the `dialog.sessionId` action target) — never formatted into a message
 * string. Nothing in this module produces user-facing text; callers map
 * the semantic error codes below to copy from he.js.
 */

export const initialSessionsState = {
  status: 'loading', // 'loading' | 'ready' | 'error'
  sessions: [],
  loadError: null, // semantic error code, see mapListErrorCode
  dialog: null, // null | { type: 'one', sessionId } | { type: 'all' }
  confirming: false,
  actionError: null, // semantic error code, see mapActionErrorCode
};

export function sessionsReducer(state, action) {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, status: 'loading', loadError: null };

    case 'FETCH_SUCCESS':
      return { ...state, status: 'ready', sessions: action.sessions, loadError: null };

    case 'FETCH_ERROR':
      return { ...state, status: 'error', sessions: [], loadError: action.code };

    case 'OPEN_REVOKE_ONE':
      // Duplicate-request guard: don't let a stray click swap the dialog's
      // target while a confirm is already in flight.
      if (state.confirming) return state;
      return { ...state, dialog: { type: 'one', sessionId: action.sessionId }, actionError: null };

    case 'OPEN_REVOKE_ALL':
      if (state.confirming) return state;
      return { ...state, dialog: { type: 'all' }, actionError: null };

    case 'CLOSE_DIALOG':
      if (state.confirming) return state;
      return { ...state, dialog: null, actionError: null };

    case 'CONFIRM_START':
      // The core duplicate-click protection: a second CONFIRM_START while
      // one is already in flight is a no-op — same state back, no second
      // transition, so a caller that (incorrectly) dispatched twice still
      // only ever fires one request.
      if (state.confirming) return state;
      return { ...state, confirming: true, actionError: null };

    case 'CONFIRM_ERROR':
      return { ...state, confirming: false, actionError: action.code };

    case 'REVOKE_DONE':
      return { ...state, confirming: false, dialog: null, actionError: null };

    default:
      return state;
  }
}

/** A session can be single-revoked through this UI iff it is not the acting Owner's current session. */
export function canRevokeSession(session) {
  return Boolean(session) && session.isCurrent !== true;
}

/** Read the opaque revoke-one target out of state, or null (revoke-all / no dialog). */
export function dialogTargetSessionId(state) {
  return state.dialog && state.dialog.type === 'one' ? state.dialog.sessionId : null;
}

/** True while a confirm is in flight — callers must not start a second request. */
export function shouldIgnoreConfirm(state) {
  return state.confirming === true;
}

/**
 * Builds the { url, method } for the confirmed dialog action. Pure — no
 * fetch call here, just the request shape, so it's testable without
 * mocking the network.
 */
export function resolveRevokeRequest(userId, dialog) {
  if (!dialog) return null;
  if (dialog.type === 'all') {
    return { url: `/api/admin/users/${userId}/sessions/revoke-all`, method: 'POST' };
  }
  if (dialog.type === 'one' && dialog.sessionId) {
    return { url: `/api/admin/users/${userId}/sessions/${dialog.sessionId}/revoke`, method: 'POST' };
  }
  return null;
}

/** GET /sessions failure -> semantic code (never the raw response body). */
export function mapListErrorCode(status) {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  return 'GENERIC';
}

/** POST revoke/revoke-all failure -> semantic code (never the raw response body). */
export function mapActionErrorCode(status, apiCode) {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 409 && apiCode === 'CANNOT_REVOKE_CURRENT_SESSION') return 'CANNOT_REVOKE_CURRENT';
  if (status === 404) return 'SESSION_GONE';
  return 'GENERIC';
}
