/*
 * POST /api/admin/users/[id]/password — Sprint 3.1: User Details Page.
 *
 * Owner-only. Body: { temporaryPassword }. Resets the target user's
 * password to an Owner-supplied value — the Security section's "reset
 * password" action on /admin/users/[id]. Same requireOwner(request) +
 * userService.assertActorIsOwner double gate as every other users route
 * (see app/api/admin/users/route.js's header comment).
 *
 * Deliberately its own route rather than another field on the existing
 * PATCH /api/admin/users/[id] handler: a password reset is a distinct,
 * more sensitive action (it invalidates the target's current credential
 * outright) and benefits from its own audit-friendly endpoint rather than
 * being one more optional key in a generic "patch some fields" body. No
 * GET/DELETE on this route — write-only, and there is nothing to read back
 * (the hash is never returned).
 *
 * There is no employee self-reset and no emailed reset-link flow — both
 * explicitly out of scope. This is Owner-initiated only, same as
 * userService.createEmployee's temporary password.
 */

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin/auth/authorize';
import { userService } from '@/lib/admin/userService';
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
  console.error('[POST /api/admin/users/[id]/password]', error);
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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // Sprint 2b — actor identity + correlationId + request-only metadata for
  // the UserPasswordReset event. The event payload itself is empty (see
  // userService.resetPassword): no credential material ever leaves here.
  const { correlationId, requestMetadata } = buildRequestAuditContext(request);

  try {
    const user = await userService.resetPassword(id, body?.temporaryPassword, {
      actorId: session.userId,
      actorRole: session.role,
      correlationId,
      requestMetadata,
    });
    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    return serviceErrorResponse(error, 'Failed to reset password.');
  }
}
