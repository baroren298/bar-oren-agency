/*
 * idleTimeout — Sprint 4 (Admin Idle Timeout & Automatic Logout).
 *
 * Pure, framework-free state machine + an injectable "controller" for the
 * Admin idle-timeout policy: 3 minutes total inactivity, a 60-second warning
 * starting at the 2-minute mark, then automatic logout. Same "extract the
 * flow logic into a plain module so it's testable without a DOM harness"
 * pattern this repo already uses for lib/admin/ui/sessionsState.js (see its
 * header comment) — this repo's vitest setup has no jsdom/@testing-library,
 * so anything that needs window/document/localStorage is written here as
 * *injected* dependencies rather than read off the real globals. That means
 * every branch (activity listeners, throttled cross-tab broadcast, absolute-
 * timestamp re-evaluation on visibility/focus, duplicate-logout guarding,
 * cleanup) is unit-testable with plain fake objects — no real browser
 * needed. components/admin/AdminIdleTimeoutManager.jsx is the only caller
 * that passes in the *real* window/document/localStorage.
 *
 * Design notes (see also SPRINT4 instructions this module implements):
 *   - Phases are derived purely from `elapsed = now() - lastActivityAt`
 *     (absolute epoch ms), never from a tick counter — so a laptop sleeping
 *     or a background tab being suspended past the timeout is caught
 *     correctly the instant the tab resumes (visibilitychange/focus call
 *     evaluate() immediately), and delayed timers never extend the session.
 *   - Multi-tab sync uses localStorage + the native `storage` event only
 *     (no new dependency, no BroadcastChannel needed). Activity writes are
 *     throttled (ACTIVITY_BROADCAST_THROTTLE_MS) so a mouse move doesn't
 *     write on every event. A logout write is a one-shot signal; other tabs
 *     react to it by redirecting immediately WITHOUT issuing their own
 *     network logout call (the originating tab's request already revoked
 *     the shared DB session — a second call would be redundant, not unsafe,
 *     but skipping it keeps "no network request on every activity event"
 *     and "prevent duplicate logout requests" true across tabs too).
 *   - Nothing written to storage is ever more than a numeric epoch-ms
 *     string — no session id, no JWT, no cookie value, ever.
 */

export const IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 180000 — total inactivity allowed
export const WARNING_DURATION_MS = 60 * 1000; // 60000 — warning length
export const WARNING_AT_MS = IDLE_TIMEOUT_MS - WARNING_DURATION_MS; // 120000

// Re-evaluation cadence while mounted. Absolute timestamps make the exact
// cadence unimportant for correctness (see module header) — this just
// controls how quickly the countdown UI updates and how promptly `expired`
// is detected in a tab that stays in the foreground the whole time.
export const TICK_INTERVAL_MS = 1000;

// How often a tab is allowed to write its own activity timestamp to shared
// storage. Keeps "avoid a design where every mouse movement broadcasts
// continuously" true regardless of how noisy the local activity is.
export const ACTIVITY_BROADCAST_THROTTLE_MS = 5000;

// Activity that resets the idle timer (policy section 2): pointer/mouse
// movement, keyboard interaction, click/pointer press, scrolling, touch.
// Escape is deliberately NOT special-cased anywhere in this module or in
// IdleWarningDialog — it is just another keydown, so it resets the timer
// like any other key rather than silently bypassing the security timeout.
export const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'scroll',
  'touchstart',
  'click',
];

export const STORAGE_KEYS = {
  activity: 'admin-idle:last-activity',
  logout: 'admin-idle:logout-signal',
};

export const LOGOUT_ENDPOINT = '/api/admin/auth/logout';
export const LOGIN_PATH = '/admin/login';

/** active (< 2min) -> warning (2min..3min) -> expired (>= 3min). */
export function getPhase(elapsedMs) {
  if (elapsedMs >= IDLE_TIMEOUT_MS) return 'expired';
  if (elapsedMs >= WARNING_AT_MS) return 'warning';
  return 'active';
}

/** Remaining warning time in ms, clamped to [0, WARNING_DURATION_MS]. */
export function getWarningRemainingMs(elapsedMs) {
  if (elapsedMs < WARNING_AT_MS) return WARNING_DURATION_MS;
  return Math.max(0, IDLE_TIMEOUT_MS - elapsedMs);
}

/** Countdown seconds shown in the dialog — starts at 60, ceilinged so it never shows 0 while still active. */
export function getCountdownSeconds(elapsedMs) {
  return Math.ceil(getWarningRemainingMs(elapsedMs) / 1000);
}

/** A storage value is only ever trusted if it's a positive finite numeric string (epoch ms). */
export function isValidTimestampValue(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

export function parseStorageTimestamp(value) {
  return isValidTimestampValue(value) ? Number(value) : null;
}

/**
 * Creates the idle-timeout controller. All browser/timing dependencies are
 * injected so this is testable with plain fake objects (see
 * idleTimeout.test.js) — the real caller (AdminIdleTimeoutManager) passes
 * the real window/document/localStorage/Date.now.
 *
 * @param {object} deps
 * @param {Window} deps.window - must support addEventListener/removeEventListener/setInterval/clearInterval
 * @param {Document} deps.document - must support addEventListener/removeEventListener/visibilityState
 * @param {Storage|null} deps.storage - localStorage-like (getItem/setItem); null disables cross-tab sync
 * @param {() => number} [deps.now] - defaults to Date.now
 * @param {(phase: 'active'|'warning'|'expired', meta: { countdownSeconds: number }) => void} [deps.onPhaseChange]
 * @param {(info: { remote: boolean, manual: boolean }) => (void|Promise<void>)} [deps.onLogout]
 * @returns {{ destroy: () => void, stayLoggedIn: () => void, logoutNow: () => Promise<void>, recordActivity: () => void, getPhase: () => string }}
 */
export function createIdleTimeoutController({
  window,
  document,
  storage = null,
  now = () => Date.now(),
  onPhaseChange,
  onLogout,
}) {
  let lastActivityAt = now();
  let lastBroadcastAt = 0;
  let phase = 'active';
  let loggingOut = false;
  let destroyed = false;
  let tickTimer = null;

  const attachedActivityEvents = [];

  function notifyPhase(elapsedMs) {
    onPhaseChange?.(phase, { countdownSeconds: getCountdownSeconds(elapsedMs) });
  }

  function setPhase(next, elapsedMs) {
    phase = next;
    notifyPhase(elapsedMs);
  }

  function evaluate() {
    if (destroyed || loggingOut) return;
    const elapsedMs = now() - lastActivityAt;
    const nextPhase = getPhase(elapsedMs);

    if (nextPhase !== phase) {
      setPhase(nextPhase, elapsedMs);
    } else if (phase === 'warning') {
      // Same phase, but the countdown still needs to tick down every second.
      notifyPhase(elapsedMs);
    }

    if (nextPhase === 'expired') {
      triggerLogout({ manual: false });
    }
  }

  function broadcastActivity(atTime) {
    if (!storage) return;
    if (atTime - lastBroadcastAt < ACTIVITY_BROADCAST_THROTTLE_MS) return;
    lastBroadcastAt = atTime;
    try {
      storage.setItem(STORAGE_KEYS.activity, String(atTime));
    } catch {
      // Storage can throw (private browsing, quota) — local timer still works.
    }
  }

  /**
   * Records activity. `broadcast: false` is used for activity adopted FROM
   * another tab's storage write, so tabs don't ping-pong writes back and
   * forth at each other.
   */
  function recordActivity(atTime = now(), { broadcast = true } = {}) {
    if (destroyed || loggingOut) return;
    lastActivityAt = atTime;
    if (broadcast) broadcastActivity(atTime);
    const elapsedMs = now() - lastActivityAt;
    const nextPhase = getPhase(elapsedMs);
    if (nextPhase !== phase) {
      setPhase(nextPhase, elapsedMs);
    }
  }

  function handleActivityEvent() {
    recordActivity(now());
  }

  function handleStorageEvent(event) {
    if (!event || destroyed) return;
    if (event.key === STORAGE_KEYS.activity) {
      const ts = parseStorageTimestamp(event.newValue);
      if (ts && ts > lastActivityAt) recordActivity(ts, { broadcast: false });
    } else if (event.key === STORAGE_KEYS.logout) {
      const ts = parseStorageTimestamp(event.newValue);
      if (ts) receiveRemoteLogout();
    }
  }

  function handleVisibilityOrFocus() {
    evaluate();
  }

  function receiveRemoteLogout() {
    if (destroyed || loggingOut) return;
    loggingOut = true;
    setPhase('expired', now() - lastActivityAt);
    Promise.resolve(onLogout?.({ remote: true, manual: false })).catch(() => {});
  }

  /** Duplicate-logout guard: a second call while one is already in flight is a synchronous no-op. */
  async function triggerLogout({ manual }) {
    if (loggingOut) return;
    loggingOut = true;
    if (storage) {
      try {
        storage.setItem(STORAGE_KEYS.logout, String(now()));
      } catch {
        // best-effort only — the local logout still proceeds.
      }
    }
    await onLogout?.({ remote: false, manual });
  }

  function stayLoggedIn() {
    recordActivity(now());
  }

  function logoutNow() {
    return triggerLogout({ manual: true });
  }

  function addActivityListeners() {
    ACTIVITY_EVENTS.forEach((type) => {
      window.addEventListener(type, handleActivityEvent, { passive: true });
      attachedActivityEvents.push(type);
    });
  }

  function removeActivityListeners() {
    attachedActivityEvents.splice(0).forEach((type) => {
      window.removeEventListener(type, handleActivityEvent);
    });
  }

  function start() {
    addActivityListeners();
    window.addEventListener('storage', handleStorageEvent);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    tickTimer = window.setInterval(evaluate, TICK_INTERVAL_MS);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    removeActivityListeners();
    window.removeEventListener('storage', handleStorageEvent);
    document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    window.removeEventListener('focus', handleVisibilityOrFocus);
    if (tickTimer !== null) {
      window.clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  start();

  return {
    destroy,
    stayLoggedIn,
    logoutNow,
    recordActivity: handleActivityEvent,
    getPhase: () => phase,
  };
}
