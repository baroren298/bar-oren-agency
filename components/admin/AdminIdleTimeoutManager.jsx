"use client";

/*
 * AdminIdleTimeoutManager — Sprint 4 (Admin Idle Timeout & Automatic Logout).
 *
 * Thin client-side glue, mounted exactly once by AdminShell.jsx (see that
 * file) so every authenticated /admin/* page that renders the shell gets the
 * idle-timeout behavior automatically, with no per-page wiring. /admin/login
 * never renders AdminShell, so it never mounts this component either — no
 * separate "is this a public page" check is needed here.
 *
 * All timer/activity/multi-tab decision logic lives in the injectable,
 * framework-free controller (lib/admin/ui/idleTimeout.js) so it's fully
 * unit-testable without a DOM harness (this repo's vitest setup has none —
 * see that file's header comment). This component's only job is to:
 *   1. create the controller in an effect with the REAL window/document/
 *      localStorage, and destroy it on unmount (cleanup — no leaked
 *      listeners/timers across page navigations within /admin/*);
 *   2. reflect the controller's phase into React state so the warning
 *      dialog renders/unrenders;
 *   3. perform the actual logout side effect (POST the existing, idempotent
 *      /api/admin/auth/logout — unchanged from Sprint 3 — then hard-redirect
 *      to /admin/login) when the controller decides it's time, whether that
 *      decision was made locally (timeout reached, or "התנתק עכשיו") or
 *      remotely (another tab logged out first — in which case this tab must
 *      NOT re-POST logout, since the session is already revoked; it only
 *      needs to redirect).
 *
 * A hard `window.location.assign` (not next/navigation's router.push) is
 * used deliberately for the redirect: it works identically whether this tab
 * is reacting to its own expiry or to a remote signal from another tab, and
 * guarantees a full reload that drops any in-memory state rather than
 * relying on client-router state that may not exist in every tab.
 *
 * Does not touch AdminLogoutButton.jsx or its route — manual logout is
 * unchanged.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import IdleWarningDialog from "./IdleWarningDialog";
import { createIdleTimeoutController, LOGOUT_ENDPOINT, LOGIN_PATH } from "@/lib/admin/ui/idleTimeout";

export default function AdminIdleTimeoutManager() {
  const [view, setView] = useState({ phase: "active", countdownSeconds: 60 });
  const controllerRef = useRef(null);

  const performLogout = useCallback(async ({ remote } = {}) => {
    if (!remote) {
      try {
        await fetch(LOGOUT_ENDPOINT, { method: "POST" });
      } catch {
        // Best-effort, same as AdminLogoutButton's existing behavior on this
        // endpoint — redirect regardless; the endpoint is idempotent and the
        // session row expires at its own expiresAt even if this call failed.
      }
    }
    window.location.assign(LOGIN_PATH);
  }, []);

  useEffect(() => {
    let storage = null;
    try {
      storage = window.localStorage;
    } catch {
      // Storage can throw in some privacy modes — the local timer still
      // works, cross-tab sync just won't be available.
      storage = null;
    }

    const controller = createIdleTimeoutController({
      window,
      document,
      storage,
      onPhaseChange: (phase, meta) => setView({ phase, countdownSeconds: meta.countdownSeconds }),
      onLogout: performLogout,
    });
    controllerRef.current = controller;

    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, [performLogout]);

  if (view.phase !== "warning") return null;

  return (
    <IdleWarningDialog
      countdownSeconds={view.countdownSeconds}
      onStay={() => controllerRef.current?.stayLoggedIn()}
      onLogoutNow={() => controllerRef.current?.logoutNow()}
    />
  );
}
