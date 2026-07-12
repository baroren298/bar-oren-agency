/*
 * GET/POST /api/admin/users — Sprint 3: Users UI.
 *
 * Owner-only user list/create. requireOwner(request) is the first,
 * independent auth gate (in addition to proxy.js's existing
 * /api/admin/* session check); userService's own assertActorIsOwner is the
 * second — same defense-in-depth pattern as the existing talent
 * approve/reject routes (see app/api/admin/talent/[id]/proposals/
 * [versionId]/approve/route.js's header comment) — so an Employee session
 * can never list or create users even if one of the two checks were ever
 * accidentally dropped in a future refactor.
 *
 * GET  -> { users: [...] } — excludes passwordHash (userRepository's
 *          SAFE_USER_SELECT already strips it).
 * POST -> creates a new EMPLOYEE account (never OWNER — see
 *          userService.createEmployee's header comment). Body:
 *          { email, displayName, temporaryPassword }.
 */

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin/auth/authorize';
import { userService } from '@/lib/admin/userService';

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
  console.error('[api/admin/users]', error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function GET(request) {
  let session;
  try {
    session = await requireOwner(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const users = await userService.listUsers({ actorRole: session.role });
    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    return serviceErrorResponse(error, 'Failed to load users.');
  }
}

export async function POST(request) {
  let session;
  try {
    session = await requireOwner(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  try {
    const user = await userService.createEmployee(
      {
        email: body.email,
        displayName: body.displayName,
        temporaryPassword: body.temporaryPassword,
      },
      { actorRole: session.role }
    );
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error, 'Failed to create employee.');
  }
}
