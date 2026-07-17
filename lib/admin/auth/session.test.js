/*
 * lib/admin/auth/session.js — Sprint 3a (Session Security Foundation).
 *
 * Covers the cryptographic half of the new session model with REAL jose
 * signing/verification (nothing mocked — this file's whole job is the
 * crypto contract):
 *
 *   S1  — a newly signed JWT carries a `sid` claim; the sid the service
 *         generates is a CSPRNG UUID (format asserted).
 *   S2  — a legacy token (valid signature, no sid) fails closed → null.
 *   S14 — tampered / foreign-signed tokens are still rejected (signature
 *         path regression).
 *   plus: signSession itself refuses to mint a token without a
 *         well-formed sid (fail closed at issuance, not just at check).
 */
import { describe, it, expect, vi } from 'vitest';
import { SignJWT, decodeJwt } from 'jose';

const TEST_SECRET = 'vitest-only-session-secret-never-a-real-value';
process.env.SESSION_SECRET = TEST_SECRET;

// sessionService is imported only for generateSessionId(); its repository
// (and, transitively, the Prisma client) must never be touched by this
// crypto-focused suite.
vi.mock('../repository/sessionRepository', () => ({ sessionRepository: {} }));

import { signSession, verifySession, SESSION_MAX_AGE_SECONDS } from './session';
import { sessionService } from './sessionService';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function key(secret = TEST_SECRET) {
  return new TextEncoder().encode(secret);
}

/** Build a pre-Sprint-3a token: validly signed, sub+role, NO sid. */
async function signLegacyToken({ userId = 'user-1', role = 'OWNER', secret = TEST_SECRET } = {}) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(key(secret));
}

describe('S1 — sid presence and shape', () => {
  it('sessionService.generateSessionId() produces a CSPRNG UUID v4', () => {
    const seen = new Set();
    for (let i = 0; i < 25; i += 1) {
      const sid = sessionService.generateSessionId();
      expect(sid).toMatch(UUID_V4_REGEX);
      seen.add(sid);
    }
    expect(seen.size).toBe(25); // no repeats across generations
  });

  it('a newly signed JWT contains the sid claim and verifies back to it', async () => {
    const sid = sessionService.generateSessionId();
    const token = await signSession({ userId: 'user-1', role: 'OWNER', sid });

    // Raw claim really present in the token…
    expect(decodeJwt(token).sid).toBe(sid);
    // …and returned through full cryptographic verification.
    const payload = await verifySession(token);
    expect(payload).toEqual({ userId: 'user-1', role: 'OWNER', sid });
  });

  it('signSession fails closed when sid is missing or malformed (never mints an unrevocable token)', async () => {
    await expect(signSession({ userId: 'user-1', role: 'OWNER' })).rejects.toThrow(/sid/);
    await expect(signSession({ userId: 'user-1', role: 'OWNER', sid: 'not-a-uuid' })).rejects.toThrow(/sid/);
    await expect(signSession({ userId: 'user-1', role: 'OWNER', sid: 42 })).rejects.toThrow(/sid/);
  });
});

describe('S2 — legacy tokens (no sid) fail closed', () => {
  it('a validly signed pre-Sprint-3a token without sid verifies to null', async () => {
    const legacy = await signLegacyToken();
    expect(await verifySession(legacy)).toBeNull();
  });

  it('a validly signed token with a malformed sid claim verifies to null', async () => {
    const token = await new SignJWT({ role: 'OWNER', sid: 'guessable-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(key());
    expect(await verifySession(token)).toBeNull();
  });
});

describe('S14 — signature path regression', () => {
  it('rejects a token signed with a foreign secret', async () => {
    const sid = sessionService.generateSessionId();
    const foreign = await new SignJWT({ role: 'OWNER', sid })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(key('attacker-controlled-secret'));
    expect(await verifySession(foreign)).toBeNull();
  });

  it('rejects a tampered token', async () => {
    const sid = sessionService.generateSessionId();
    const token = await signSession({ userId: 'user-1', role: 'EMPLOYEE', sid });
    const [header, payload, signature] = token.split('.');
    // Re-encode the payload with role escalated; signature no longer matches.
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    decoded.role = 'OWNER';
    const forged = `${header}.${Buffer.from(JSON.stringify(decoded)).toString('base64url')}.${signature}`;
    expect(await verifySession(forged)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const sid = sessionService.generateSessionId();
    const expired = await new SignJWT({ role: 'OWNER', sid })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key());
    expect(await verifySession(expired)).toBeNull();
  });

  it('rejects garbage and missing tokens', async () => {
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession('')).toBeNull();
    expect(await verifySession('not.a.jwt')).toBeNull();
  });
});
