/*
 * idleTimeout controller tests — Sprint 4 (Admin Idle Timeout & Automatic
 * Logout).
 *
 * No jsdom/@testing-library in this repo's vitest setup (see
 * lib/admin/ui/sessionsState.js's header comment for the established
 * pattern), so every browser dependency the controller needs
 * (window/document/storage) is a small fake object built here, not a real
 * DOM. `now` is fully controlled per-test so "elapsed time" assertions never
 * depend on real wall-clock speed — including the "delayed timers / sleeping
 * tab" scenarios, which jump `now` directly without ever firing the 1s tick,
 * exactly like a suspended background tab would.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createIdleTimeoutController,
  getPhase,
  getWarningRemainingMs,
  getCountdownSeconds,
  IDLE_TIMEOUT_MS,
  WARNING_AT_MS,
  ACTIVITY_EVENTS,
  ACTIVITY_BROADCAST_THROTTLE_MS,
  STORAGE_KEYS,
} from './idleTimeout';

function createFakeWindow() {
  const listeners = new Map();
  return {
    addEventListener: vi.fn((type, handler) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    }),
    removeEventListener: vi.fn((type, handler) => {
      listeners.get(type)?.delete(handler);
    }),
    setInterval: (...args) => setInterval(...args),
    clearInterval: (...args) => clearInterval(...args),
    dispatch(type, event) {
      listeners.get(type)?.forEach((handler) => handler(event));
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

function createFakeDocument() {
  const listeners = new Map();
  return {
    visibilityState: 'visible',
    addEventListener: vi.fn((type, handler) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    }),
    removeEventListener: vi.fn((type, handler) => {
      listeners.get(type)?.delete(handler);
    }),
    dispatch(type, event) {
      listeners.get(type)?.forEach((handler) => handler(event));
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

function createFakeStorage() {
  const data = new Map();
  return {
    setItem: vi.fn((key, value) => data.set(key, String(value))),
    getItem: vi.fn((key) => (data.has(key) ? data.get(key) : null)),
    removeItem: vi.fn((key) => data.delete(key)),
  };
}

describe('idleTimeout — pure phase math', () => {
  it('active below the warning threshold, warning at/after it, expired at/after the full timeout', () => {
    expect(getPhase(0)).toBe('active');
    expect(getPhase(WARNING_AT_MS - 1)).toBe('active');
    expect(getPhase(WARNING_AT_MS)).toBe('warning');
    expect(getPhase(IDLE_TIMEOUT_MS - 1)).toBe('warning');
    expect(getPhase(IDLE_TIMEOUT_MS)).toBe('expired');
    expect(getPhase(IDLE_TIMEOUT_MS + 5000)).toBe('expired');
  });

  it('countdown starts at exactly 60 seconds the instant warning begins', () => {
    expect(getCountdownSeconds(WARNING_AT_MS)).toBe(60);
  });

  it('countdown reaches 0 at the full timeout, never negative', () => {
    expect(getCountdownSeconds(IDLE_TIMEOUT_MS)).toBe(0);
    expect(getWarningRemainingMs(IDLE_TIMEOUT_MS + 10_000)).toBe(0);
  });
});

describe('idleTimeout — controller: warning + logout timing', () => {
  let baseNow;

  beforeEach(() => {
    vi.useFakeTimers();
    baseNow = 1_000_000_000_000;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(overrides = {}) {
    const win = createFakeWindow();
    const doc = createFakeDocument();
    const storage = createFakeStorage();
    let current = baseNow;
    const onPhaseChange = vi.fn();
    const onLogout = vi.fn().mockResolvedValue(undefined);

    const controller = createIdleTimeoutController({
      window: win,
      document: doc,
      storage,
      now: () => current,
      onPhaseChange,
      onLogout,
      ...overrides,
    });

    return {
      win,
      doc,
      storage,
      onPhaseChange,
      onLogout,
      controller,
      advance(ms) {
        current += ms;
        vi.advanceTimersByTime(ms);
      },
      jumpTo(ms) {
        current += ms; // move the clock without running any timers/ticks
      },
    };
  }

  it('shows the warning after exactly 2 minutes without activity', () => {
    const { advance, onPhaseChange } = setup();
    advance(WARNING_AT_MS);
    expect(onPhaseChange).toHaveBeenCalledWith('warning', { countdownSeconds: 60 });
  });

  it('does not warn before 2 minutes', () => {
    const { advance, onPhaseChange } = setup();
    advance(WARNING_AT_MS - 1000);
    expect(onPhaseChange).not.toHaveBeenCalledWith('warning', expect.anything());
  });

  it('logs out automatically after the full 3-minute inactivity period', () => {
    const { advance, onLogout } = setup();
    advance(IDLE_TIMEOUT_MS);
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledWith({ remote: false, manual: false });
  });

  it('activity before the warning resets the timer (no warning at 2min if reset at 1min)', () => {
    const { advance, controller, onPhaseChange } = setup();
    advance(60_000);
    controller.recordActivity();
    onPhaseChange.mockClear();
    advance(WARNING_AT_MS - 1); // would have warned already if not reset
    expect(onPhaseChange).not.toHaveBeenCalledWith('warning', expect.anything());
  });

  it('activity during the warning dismisses it and resets the timer', () => {
    const { advance, controller, onPhaseChange } = setup();
    advance(WARNING_AT_MS);
    expect(onPhaseChange).toHaveBeenCalledWith('warning', { countdownSeconds: 60 });
    onPhaseChange.mockClear();
    controller.recordActivity();
    expect(onPhaseChange).toHaveBeenCalledWith('active', expect.anything());
  });

  it('"הישאר מחובר" (stayLoggedIn) resets the timer back to active', () => {
    const { advance, controller, onPhaseChange } = setup();
    advance(WARNING_AT_MS + 30_000);
    onPhaseChange.mockClear();
    controller.stayLoggedIn();
    expect(onPhaseChange).toHaveBeenCalledWith('active', expect.anything());
    // and the full window is available again, not just the leftover countdown
    advance(WARNING_AT_MS - 1000);
    expect(onPhaseChange).not.toHaveBeenCalledWith('warning', expect.anything());
  });

  it('"התנתק עכשיו" (logoutNow) logs out immediately, mid-warning, without waiting for the countdown to finish', () => {
    const { advance, controller, onLogout } = setup();
    advance(WARNING_AT_MS + 10_000); // well inside the 60s warning
    controller.logoutNow();
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledWith({ remote: false, manual: true });
  });

  it('duplicate logout requests are prevented (auto-expiry racing a manual logoutNow call)', async () => {
    const { advance, controller, onLogout } = setup();
    advance(IDLE_TIMEOUT_MS); // triggers automatic logout
    await controller.logoutNow(); // a stray extra call, e.g. a queued click
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('duplicate logoutNow calls in immediate succession only log out once', async () => {
    const { controller, onLogout } = setup();
    await Promise.all([controller.logoutNow(), controller.logoutNow()]);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('countdown ticks down each second while in warning', () => {
    const { advance, onPhaseChange } = setup();
    advance(WARNING_AT_MS);
    onPhaseChange.mockClear();
    advance(1000);
    expect(onPhaseChange).toHaveBeenCalledWith('warning', { countdownSeconds: 59 });
  });
});

describe('idleTimeout — controller: cleanup on destroy', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('removes every activity listener, the storage/visibility/focus listeners, and stops the tick timer', () => {
    const win = createFakeWindow();
    const doc = createFakeDocument();
    const controller = createIdleTimeoutController({ window: win, document: doc, storage: null });

    ACTIVITY_EVENTS.forEach((type) => expect(win.listenerCount(type)).toBe(1));
    expect(win.listenerCount('storage')).toBe(1);
    expect(win.listenerCount('focus')).toBe(1);
    expect(doc.listenerCount('visibilitychange')).toBe(1);

    controller.destroy();

    ACTIVITY_EVENTS.forEach((type) => expect(win.listenerCount(type)).toBe(0));
    expect(win.listenerCount('storage')).toBe(0);
    expect(win.listenerCount('focus')).toBe(0);
    expect(doc.listenerCount('visibilitychange')).toBe(0);
  });

  it('a destroyed controller ignores further activity and never fires onPhaseChange again', () => {
    const win = createFakeWindow();
    const doc = createFakeDocument();
    const onPhaseChange = vi.fn();
    const controller = createIdleTimeoutController({ window: win, document: doc, storage: null, onPhaseChange });

    controller.destroy();
    controller.recordActivity();
    win.dispatch('mousemove', {});
    vi.advanceTimersByTime(10 * 60 * 1000);

    expect(onPhaseChange).not.toHaveBeenCalled();
  });

  it('destroy() is idempotent (safe to call twice, e.g. StrictMode double-invoke)', () => {
    const win = createFakeWindow();
    const doc = createFakeDocument();
    const controller = createIdleTimeoutController({ window: win, document: doc, storage: null });
    expect(() => {
      controller.destroy();
      controller.destroy();
    }).not.toThrow();
  });
});

describe('idleTimeout — background tabs / sleeping devices (absolute timestamps, no drift)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a tab that never ticks (simulating suspension) still reports "expired" the instant it resumes on focus, based on real elapsed time', () => {
    const win = createFakeWindow();
    const doc = createFakeDocument();
    let current = 1_000_000_000_000;
    const onPhaseChange = vi.fn();
    const onLogout = vi.fn().mockResolvedValue(undefined);
    createIdleTimeoutController({
      window: win,
      document: doc,
      storage: null,
      now: () => current,
      onPhaseChange,
      onLogout,
    });

    // Simulate a laptop sleeping for 10 minutes: the clock jumps, but no
    // interval tick and no visibilitychange/focus event fires during the
    // sleep itself (the tab was fully suspended).
    current += 10 * 60 * 1000;

    // On resume, the browser fires focus/visibilitychange — nothing else.
    win.dispatch('focus', {});

    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(onPhaseChange).toHaveBeenCalledWith('expired', expect.anything());
  });

  it('a resume inside the warning window (not yet expired) shows the warning with the correctly reduced countdown, not a fresh 60s', () => {
    const win = createFakeWindow();
    const doc = createFakeDocument();
    let current = 1_000_000_000_000;
    const onPhaseChange = vi.fn();
    createIdleTimeoutController({ window: win, document: doc, storage: null, now: () => current, onPhaseChange });

    current += WARNING_AT_MS + 20_000; // 20s into the 60s warning, no ticks fired
    doc.visibilityState = 'visible';
    doc.dispatch('visibilitychange', {});

    expect(onPhaseChange).toHaveBeenCalledWith('warning', { countdownSeconds: 40 });
  });

  it('does not extend the session just because timers were delayed: expiry is based on elapsed time, not on the number of ticks that fired', () => {
    const win = createFakeWindow();
    const doc = createFakeDocument();
    let current = 1_000_000_000_000;
    const onLogout = vi.fn().mockResolvedValue(undefined);
    createIdleTimeoutController({ window: win, document: doc, storage: null, now: () => current, onLogout });

    // Jump straight past the full timeout in one go (zero ticks in between).
    current += IDLE_TIMEOUT_MS + 1;
    win.dispatch('focus', {});

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

describe('idleTimeout — multi-tab synchronization', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function makeTab(storage, current) {
    const win = createFakeWindow();
    const doc = createFakeDocument();
    const onPhaseChange = vi.fn();
    const onLogout = vi.fn().mockResolvedValue(undefined);
    const controller = createIdleTimeoutController({
      window: win,
      document: doc,
      storage,
      now: () => current.value,
      onPhaseChange,
      onLogout,
    });
    return { win, doc, controller, onPhaseChange, onLogout };
  }

  it('activity in one tab keeps a second (otherwise idle) tab from warning, via the shared storage timestamp', () => {
    const storage = createFakeStorage();
    const clockA = { value: 1_000_000_000_000 };
    const clockB = { value: clockA.value };
    const tabA = makeTab(storage, clockA);
    const tabB = makeTab(storage, clockB);

    // Tab B is idle for close to the warning threshold...
    clockB.value += WARNING_AT_MS - 5000;
    // ...but Tab A was active a moment ago and broadcasts it.
    clockA.value = clockB.value;
    tabA.controller.recordActivity();
    const [, activityValue] = storage.setItem.mock.calls.find(([key]) => key === STORAGE_KEYS.activity);

    // The browser delivers the 'storage' event to OTHER tabs only.
    tabB.win.dispatch('storage', { key: STORAGE_KEYS.activity, newValue: activityValue });

    tabB.onPhaseChange.mockClear();
    clockB.value += WARNING_AT_MS - 1000; // would warn if Tab A's activity hadn't reset it
    expect(tabB.onPhaseChange).not.toHaveBeenCalledWith('warning', expect.anything());
  });

  it('a logout in one tab makes every other tab redirect promptly WITHOUT issuing its own logout request', () => {
    const storage = createFakeStorage();
    const clockA = { value: 1_000_000_000_000 };
    const clockB = { value: clockA.value };
    const tabA = makeTab(storage, clockA);
    const tabB = makeTab(storage, clockB);

    tabA.controller.logoutNow();
    expect(tabA.onLogout).toHaveBeenCalledWith({ remote: false, manual: true });

    const [, logoutValue] = storage.setItem.mock.calls.find(([key]) => key === STORAGE_KEYS.logout);
    tabB.win.dispatch('storage', { key: STORAGE_KEYS.logout, newValue: logoutValue });

    expect(tabB.onLogout).toHaveBeenCalledTimes(1);
    expect(tabB.onLogout).toHaveBeenCalledWith({ remote: true, manual: false });
  });

  it('local activity broadcasts are throttled/coalesced, not sent on every single event', () => {
    const storage = createFakeStorage();
    const clock = { value: 1_000_000_000_000 };
    const { controller } = makeTab(storage, clock);

    controller.recordActivity();
    controller.recordActivity();
    controller.recordActivity();
    clock.value += ACTIVITY_BROADCAST_THROTTLE_MS - 1;
    controller.recordActivity();

    const activityWrites = storage.setItem.mock.calls.filter(([key]) => key === STORAGE_KEYS.activity);
    expect(activityWrites).toHaveLength(1);

    clock.value += 1;
    controller.recordActivity();
    const activityWritesAfterThrottle = storage.setItem.mock.calls.filter(([key]) => key === STORAGE_KEYS.activity);
    expect(activityWritesAfterThrottle).toHaveLength(2);
  });
});

describe('idleTimeout — privacy: only non-sensitive timestamps ever touch storage', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('every value ever written to storage is a bare positive numeric string, never containing session/token-like content', () => {
    const storage = createFakeStorage();
    const win = createFakeWindow();
    const doc = createFakeDocument();
    let current = 1_000_000_000_000;
    const controller = createIdleTimeoutController({
      window: win,
      document: doc,
      storage,
      now: () => current,
      onLogout: vi.fn().mockResolvedValue(undefined),
    });

    controller.recordActivity();
    current += IDLE_TIMEOUT_MS;
    controller.logoutNow();

    const keysWritten = new Set(storage.setItem.mock.calls.map(([key]) => key));
    expect(keysWritten).toEqual(new Set([STORAGE_KEYS.activity, STORAGE_KEYS.logout]));

    storage.setItem.mock.calls.forEach(([, value]) => {
      expect(String(value)).toMatch(/^\d+$/);
    });
  });
});
