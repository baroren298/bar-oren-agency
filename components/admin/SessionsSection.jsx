"use client";

/*
 * SessionsSection — Sprint 3c (Session Management UI).
 *
 * The "use client" container for the "התחברויות" card on the User Details
 * page: owns the useReducer(sessionsReducer) state, fetches the session
 * list on mount from the Sprint 3b API, and issues the revoke / revoke-all
 * POSTs once a ConfirmDialog is confirmed. All rendering is delegated to
 * SessionsPanel.jsx (presentational, prop-driven) — this file has no JSX
 * beyond forwarding props, so the reducer transitions and the network
 * calls stay easy to reason about independently.
 *
 * No response body is ever logged (matches every other route.js in this
 * sprint's header comments) and no raw server error text is ever shown —
 * mapListErrorCode/mapActionErrorCode translate the HTTP status (and, for
 * actions, the API's `code` field) into one of a small set of generic,
 * pre-written copy strings from he.js. See lib/admin/ui/sessionsState.js
 * for why that mapping lives in a plain function instead of inline here.
 *
 * Props:
 *   - userId (string, required) — the target user's id (already the
 *     opaque route param every other section of UserDetailClient.jsx
 *     uses; never a session id).
 *   - isSelfView (boolean, required) — is the acting Owner viewing their
 *     own user record? Passed down from page.jsx (session.userId ===
 *     user.id), used only to choose the revoke-all copy variant — the
 *     server independently decides whether to spare the current session.
 */

import { useCallback, useEffect, useReducer } from "react";
import SessionsPanel from "./SessionsPanel";
import {
  initialSessionsState,
  sessionsReducer,
  canRevokeSession,
  shouldIgnoreConfirm,
  resolveRevokeRequest,
  mapListErrorCode,
  mapActionErrorCode,
} from "@/lib/admin/ui/sessionsState";

export default function SessionsSection({ userId, isSelfView }) {
  const [state, dispatch] = useReducer(sessionsReducer, initialSessionsState);

  const fetchSessions = useCallback(async () => {
    dispatch({ type: "FETCH_START" });
    try {
      const response = await fetch(`/api/admin/users/${userId}/sessions`);
      if (!response.ok) {
        dispatch({ type: "FETCH_ERROR", code: mapListErrorCode(response.status) });
        return;
      }
      const body = await response.json().catch(() => ({}));
      dispatch({ type: "FETCH_SUCCESS", sessions: Array.isArray(body.sessions) ? body.sessions : [] });
    } catch {
      dispatch({ type: "FETCH_ERROR", code: "GENERIC" });
    }
  }, [userId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  function requestRevokeOne(sessionId) {
    const target = state.sessions.find((session) => session.id === sessionId);
    if (!canRevokeSession(target)) return;
    dispatch({ type: "OPEN_REVOKE_ONE", sessionId });
  }

  function requestRevokeAll() {
    dispatch({ type: "OPEN_REVOKE_ALL" });
  }

  function cancelDialog() {
    dispatch({ type: "CLOSE_DIALOG" });
  }

  async function confirmDialog() {
    // Duplicate-request guard: a stray second invocation (double click
    // before the disabled attribute takes effect) is a synchronous no-op —
    // it never reaches fetch.
    if (shouldIgnoreConfirm(state)) return;
    dispatch({ type: "CONFIRM_START" });

    const request = resolveRevokeRequest(userId, state.dialog);
    if (!request) {
      dispatch({ type: "CONFIRM_ERROR", code: "GENERIC" });
      return;
    }

    try {
      const response = await fetch(request.url, { method: request.method });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        dispatch({ type: "CONFIRM_ERROR", code: mapActionErrorCode(response.status, body.code) });
        return;
      }

      dispatch({ type: "REVOKE_DONE" });
      await fetchSessions();
    } catch {
      dispatch({ type: "CONFIRM_ERROR", code: "GENERIC" });
    }
  }

  return (
    <SessionsPanel
      status={state.status}
      sessions={state.sessions}
      loadError={state.loadError}
      isSelfView={isSelfView}
      dialog={state.dialog}
      confirming={state.confirming}
      actionError={state.actionError}
      onRequestRevokeOne={requestRevokeOne}
      onRequestRevokeAll={requestRevokeAll}
      onConfirm={confirmDialog}
      onCancel={cancelDialog}
    />
  );
}
