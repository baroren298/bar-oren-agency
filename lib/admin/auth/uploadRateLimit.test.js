/*
 * uploadRateLimit — Production Upload Enablement sprint. Fixed-window,
 * per-user, defaults 30 uploads / 60s (env-overridable via
 * UPLOAD_RATE_LIMIT_* — read at module load, same as the login limiter's
 * LOGIN_RATE_LIMIT_*, so defaults are what this file exercises).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { consumeUploadSlot, resetUploadRateLimit } from './uploadRateLimit';

beforeEach(() => {
  resetUploadRateLimit();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  resetUploadRateLimit();
});

describe('consumeUploadSlot', () => {
  it('allows up to 30 uploads in a window, then refuses', () => {
    for (let i = 0; i < 30; i += 1) {
      expect(consumeUploadSlot('user-1')).toBe(true);
    }
    expect(consumeUploadSlot('user-1')).toBe(false);
    expect(consumeUploadSlot('user-1')).toBe(false);
  });

  it('tracks users independently — one user hitting the limit never throttles another', () => {
    for (let i = 0; i < 31; i += 1) consumeUploadSlot('user-1');
    expect(consumeUploadSlot('user-1')).toBe(false);

    expect(consumeUploadSlot('user-2')).toBe(true);
  });

  it('opens a fresh window once the previous one expires', () => {
    for (let i = 0; i < 31; i += 1) consumeUploadSlot('user-1');
    expect(consumeUploadSlot('user-1')).toBe(false);

    vi.advanceTimersByTime(61 * 1000);

    expect(consumeUploadSlot('user-1')).toBe(true);
  });

  it('keeps refusing within the same window after the limit is reached', () => {
    for (let i = 0; i < 31; i += 1) consumeUploadSlot('user-1');

    vi.advanceTimersByTime(30 * 1000); // still inside the 60s window

    expect(consumeUploadSlot('user-1')).toBe(false);
  });
});
