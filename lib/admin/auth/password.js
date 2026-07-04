/*
 * Password hashing — Phase 2: Auth/Security.
 *
 * Uses bcryptjs (pure JS, no native build step) rather than bcrypt, per the
 * approved Phase 2 plan. Only ever imported from Node-runtime code (the
 * login route handler, scripts/create-owner.js) — never from middleware.js,
 * which runs on the Edge runtime and cannot use bcryptjs.
 */

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * A hash of a random, never-used password. Used by the login route to run
 * a bcrypt.compare() even when the looked-up email doesn't exist, so a
 * missing-user response takes the same amount of time as a wrong-password
 * response (timing-based email enumeration mitigation).
 *
 * Generated once and hardcoded — it doesn't need to be secret or rotated,
 * it just needs to be a real bcrypt hash so the compare does real work.
 */
export const DUMMY_PASSWORD_HASH =
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

/** Hash a plaintext password for storage. */
export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/** Compare a plaintext password against a stored bcrypt hash. */
export async function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}
