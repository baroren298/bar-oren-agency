/*
 * POST /api/admin/users/[id]/sessions/revoke-all — Sprint 3b (Session
 * Management API).
 *
 * Owner-only. Revokes ALL of the target user's active sessions. When the
 * Owner targets themself, their CURRENT session is spared ("sign out
 * everywhere else" — approved design; full sign-out remains logout). No
 * request body is read. Note this is NOT a login ban — the atomic ban
 * path is Deactivate (which revokes sessions in the same transaction).
 *
 * Response: 200 { revoked: n } — n may be 0 (idempotent; the revoke-all
 * INTENT is still audited by the service even at count 0, per approved
 * decision).
 *
 * Next.js resolves this static `revoke-all` segment ahead of the sibling
 * dynamic [sessionId] segment, and sids are UUIDs, so no collision is
 * possible. buildRequestAuditContext is used for correlationId ONLY —
 * no ip/user-agent passthrough on session-revocation events.
 */

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin/auth/authorize';
import { sessionManagementService } from '@/lib/admin/sessionManagementService';
import { buildRequestAuditContext } from '@/lib/admin/requestAuditContext';

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
  console.error('[POST /api/admin/users/[id]/sessions/revoke-all]', error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function POST(request, { params }) {
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

  const { correlationId } = buildRequestAuditContext(request);

  try {
    const result = await sessionManagementService.revokeAllSessions(id, {
      actorId: session.userId,
      actorRole: session.role,
      actorSid: session.sid,
      correlationId,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return serviceErrorResponse(error, 'Failed to revoke sessions.');
  }
}
