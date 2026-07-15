/*
 * POST /api/admin/auth/logout — Phase 2: Auth/Security, upgraded by Sprint
 * 3a (Session Security Foundation).
 *
 * Sprint 3a: before clearing the cookie, the DB Session referenced by the
 * token's sid is revoked so the token is dead server-side immediately —
 * not merely absent from this one browser.
 *
 * IDEMPOTENT BY DESIGN, success in ALL cases: missing cookie, invalid
 * signature, legacy token without sid, unknown/expired/already-revoked
 * session — logging out of a dead session is harmless, and returning
 * anything but success would leak session state (revoked vs expired vs
 * missing must be indistinguishable to a client). The revoke itself uses
 * an updateMany filtered on revokedAt: null, so a double logout is a
 * 0-row no-op.
 *
 * If the revoke DB write itself throws, the cookie is STILL cleared and
 * success still returned — the user's local logout intent is honored, and
 * the row dies at its expiresAt regardless. The failure is logged as a
 * SECURITY GAP with no token/sid contents (log hygiene).
 *
 * POST (not GET) so logout can't be triggered as a side effect of a
 * prefetch or a link being crawled. No auth check required to call this —
 * proxy.js allow-lists this path for exactly this reason (see proxy.js).
 */

import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/admin/auth/session';
import { sessionService } from '@/lib/admin/auth/sessionService';

export async function POST(request) {
  const token = request?.cookies?.get?.(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const payload = await verifySession(token);
    if (payload?.sid) {
      try {
        await sessionService.revokeSession(payload.sid);
      } catch {
        console.error(
          '[admin/auth/logout] SECURITY GAP — session revoke failed during logout; ' +
            'cookie cleared anyway, row expires at its own expiresAt.'
        );
      }
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
