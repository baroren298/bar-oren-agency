/*
 * POST /api/admin/auth/logout — Phase 2: Auth/Security.
 *
 * Clears the session cookie. POST (not GET) so logout can't be triggered
 * as a side effect of a prefetch or a link being crawled. No auth check
 * required to call this — logging out an already-logged-out session is a
 * harmless no-op, and proxy.js allow-lists this path for exactly
 * this reason (see proxy.js).
 */

import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/admin/auth/session';

export async function POST() {
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
