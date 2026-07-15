/*
 * GET /api/admin/users/[id]/sessions — Sprint 3b (Session Management API).
 *
 * Owner-only. Lists the target user's ACTIVE sessions (not revoked, not
 * expired), newest first, hard-capped at 50 (no pagination — approved
 * design). Response: { sessions: [{ id, createdAt, expiresAt, isCurrent }] }.
 * Same requireOwner(request) + service assertActorIsOwner double gate as
 * every other users route (see app/api/admin/users/route.js).
 *
 * The acting Owner's own sid is passed to the service ONLY to stamp
 * `isCurrent` on their own row — it never appears in logs or audit data.
 * Error bodies stay generic (401/403 identical to the rest of the users
 * surface; no session-state enumeration, no internal DB errors).
 */

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin/auth/authorize';
import { sessionManagementService } from '@/lib/admin/sessionManagementService';

function authErrorResponse(error) {
  return NextResponse.json(
    { error: error.statusCode === 403 ? 'Only the Owner may manage users.' : 'Not authenticated.' },
    { status: error.statusCode || 401 }
  );
}

function serviceErrorResponse(error, fallbackMessage) {
  if (error.statusCode) {
    const body = { error: error.message || fallbackMessage };
    if (error.fieldErrors) body.fieldErrors = error.fieldErrors;
    if (error.code) body.code = error.code;
    return NextResponse.json(body, { status: error.statusCode });
  }
  console.error('[GET /api/admin/users/[id]/sessions]', error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function GET(request, { params }) {
  let session;
  try {
    session = await requireOwner(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'User id is required.' }, { status: 400 });
  }

  try {
    const sessions = await sessionManagementService.listSessions(id, {
      actorRole: session.role,
      actorSid: session.sid,
    });
    return NextResponse.json({ sessions }, { status: 200 });
  } catch (error) {
    return serviceErrorResponse(error, 'Failed to load sessions.');
  }
}
