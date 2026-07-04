/*
 * Listener registry — Sprint 3.2 (ADMIN_PANEL_PLAN.md Section 13.2/13.7).
 *
 * eventService.js calls `getListeners()` after every successful `emit()`
 * and invokes each one with the just-written Event row. This registry is
 * kept in its own module, separate from eventService itself, so adding or
 * removing a listener is a one-line change here and never requires
 * touching the service (consistent with Section 13.9 — engine services
 * stay generic; specific behavior is plugged in, not branched on).
 *
 * Each listener has the shape `async (event) => {}`. eventService is
 * responsible for catching and logging listener errors (Section 13.13:
 * "listener failure handling needs to be explicit ... not assumed safe by
 * default") — listeners do not need their own defensive try/catch for
 * that reason, though they may still throw to surface a real bug.
 *
 * Sprint 3.7: auditLogListener is now implemented for real (see its own
 * header for the EVENT_TYPE -> ActionType mapping and the documented
 * VERSION_PUBLISHED gap) and is registered below — the one-line change
 * this file's previous comment anticipated.
 */

import { auditLogListener } from './auditLogListener';

/** @type {Array<(event: object) => Promise<void>>} */
const listeners = [auditLogListener];

/** Returns the current list of registered listeners (in registration order). */
export function getListeners() {
  return listeners;
}

/**
 * Register an additional listener at runtime (e.g. from a test, or once
 * auditLogListener is ready to go live). Returns an unregister function.
 */
export function registerListener(listener) {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index !== -1) listeners.splice(index, 1);
  };
}

export { auditLogListener };
