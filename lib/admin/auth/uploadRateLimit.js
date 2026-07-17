/*
 * Upload rate limiting — Production Upload Enablement sprint.
 *
 * Sibling of rateLimit.js (the login limiter) and deliberately the same
 * shape: an in-memory fixed-window counter, env-configurable the same way
 * (LOGIN_RATE_LIMIT_* -> UPLOAD_RATE_LIMIT_*), keyed per authenticated user
 * rather than per IP+email — the upload route only runs after
 * requireOwnerOrEmployee(), so session.userId is the natural, spoof-proof
 * key. Counts every upload attempt (valid or not): the point is to bound
 * how fast one session can hammer the storage provider, not to punish only
 * failures.
 *
 * KNOWN LIMITATION (same as rateLimit.js, same seam): state lives in
 * process memory — resets on redeploy, not shared across serverless
 * instances. Good enough for this admin panel's traffic; if that changes,
 * swap the internals for an external store without changing the
 * consumeUploadSlot() call site in the upload route.
 */

const WINDOW_MS = (Number(process.env.UPLOAD_RATE_LIMIT_WINDOW_SECONDS) || 60) * 1000; // 1 min
const MAX_UPLOADS = Number(process.env.UPLOAD_RATE_LIMIT_MAX_UPLOADS) || 30;

/** userId -> { count, windowStart } */
const uploads = new Map();

function prune(now) {
  for (const [key, entry] of uploads) {
    if (now - entry.windowStart > WINDOW_MS) uploads.delete(key);
  }
}

/**
 * Record one upload attempt for this user and report whether it is allowed.
 * Check + record are a single call on purpose — there is no way to consume
 * a slot without it counting, and no way to check without consuming.
 *
 * @param {string} userId
 * @returns {boolean} true if the attempt is within the limit, false if the
 *   user has exhausted the current window (caller should respond 429).
 */
export function consumeUploadSlot(userId) {
  const now = Date.now();
  prune(now);
  const key = userId || 'unknown';
  const entry = uploads.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    uploads.set(key, { count: 1, windowStart: now });
    return true;
  }

  entry.count += 1;
  return entry.count <= MAX_UPLOADS;
}

/**
 * Test-only escape hatch: the counter map is module state, so without this
 * every test file's cases would leak attempts into each other. Never called
 * by application code.
 */
export function resetUploadRateLimit() {
  uploads.clear();
}
