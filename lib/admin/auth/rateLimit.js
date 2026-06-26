/*
 * Login rate limiting — Phase 2: Auth/Security.
 *
 * In-memory token-bucket-style limiter keyed by IP+email. Deliberately
 * simple for v1 (single Owner account, low traffic).
 *
 * KNOWN LIMITATION: this state lives in process memory. It resets on
 * redeploy and is NOT shared across instances if the app ever runs on
 * multi-instance serverless hosting — see ADMIN_PANEL_PLAN.md Section 13
 * (deployment topology is still an open question). If that turns out to be
 * the deployment model, replace this with an external store (e.g. an
 * Upstash/Redis-backed limiter) without changing the call site in the
 * login route — recordFailedAttempt()/isRateLimited() is the seam.
 */

const WINDOW_MS = (Number(process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS) || 900) * 1000; // 15 min
const MAX_ATTEMPTS = Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS) || 5;

/** key -> { count, windowStart } */
const attempts = new Map();

function keyFor(ip, email) {
  return `${ip || 'unknown'}:${(email || '').trim().toLowerCase()}`;
}

function prune(now) {
  for (const [key, entry] of attempts) {
    if (now - entry.windowStart > WINDOW_MS) attempts.delete(key);
  }
}

/** Returns true if this IP+email combination has exceeded the attempt limit. */
export function isRateLimited(ip, email) {
  const now = Date.now();
  const entry = attempts.get(keyFor(ip, email));
  if (!entry) return false;
  if (now - entry.windowStart > WINDOW_MS) return false; // window expired
  return entry.count >= MAX_ATTEMPTS;
}

/** Record a failed login attempt for this IP+email combination. */
export function recordFailedAttempt(ip, email) {
  const now = Date.now();
  prune(now);
  const key = keyFor(ip, email);
  const entry = attempts.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
}

/** Clear attempts for this IP+email combination after a successful login. */
export function clearAttempts(ip, email) {
  attempts.delete(keyFor(ip, email));
}
