/*
 * POST /api/admin/users/[id]/sessions/[sessionId]/revoke — Sprint 3b
 * (Session Management API).
 *
 * Owner-only. Revokes ONE of the target user's sessions. POST action
 * subroute (codebase convention — revoke is an idempotent state
 * transition, not a deletion). No request body is read — both parameters
 * live in the URL, and nothing from a body is ever logged or audited.
 *
 * Response contract (all approved):
 *   200 { revoked: 1 }  — effective revocation (audited by the service)
 *   200 { revoked: 0 }  — already revoked/expired (idempotent; not audited)
 *   404 SESSION_NOT_FOUND — unknown id OR another user's session (one
 *        indistinguishable response; the service enforces the scoping)
 *   409 CANNOT_REVOKE_CURRENT_SESSION — the acting Owner's own current
 *        session (logout is the explicit path for that)
 *
 * buildRequestAuditContext is used for its correlationId ONLY — the
 * requestMetadata (ip/user-agent) is deliberately NOT passed through:
 * session-revocation audit events carry no connection data (approved
 * hygiene decision, stricter than the Sprint 2b user events).
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
  console.error('[POST /api/admin/users/[id]/sessions/[sessionId]/revoke]', error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function POST(request, { params }) {
  let session;
  try {
    session = await requireOwner(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id, sessionId } = await params;
  if (!id || !sessionId) {
    return NextResponse.json({ error: 'User id and session id are required.' }, { status: 400 });
  }

  const { correlationId } = buildRequestAuditContext(request);

  try {
    const result = await sessionManagementService.revokeSession(id, sessionId, {
      actorId: session.userId,
      actorRole: session.role,
      actorSid: session.sid,
      correlationId,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return serviceErrorResponse(error, 'Failed to revoke session.');
  }
}
