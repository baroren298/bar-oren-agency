/*
 * PATCH /api/admin/users/[id] — Sprint 3: Users UI, extended by Sprint 3.2
 * (User Detail UX Cleanup).
 *
 * Owner-only. Body may include `displayName`, `email`, and/or `isActive` —
 * this route applies whichever of the three is present, similar in shape to
 * the existing proposals PATCH route's partial-fields body (app/api/admin/
 * talent/[id]/proposals/[versionId]/route.js). `role` is never accepted at
 * all: this sprint explicitly does not support changing role, and a `role`
 * key in the body is rejected outright (400) rather than silently ignored,
 * so a client bug can't quietly no-op instead of surfacing.
 *
 * The Profile section on /admin/users/[id] sends `displayName` and `email`
 * together in one PATCH (a single "edit profile" mode — see
 * UserDetailClient.jsx). They're still applied as two independent
 * userService calls, displayName first, email second: email is the more
 * likely of the two to fail (duplicate-email protection), and it's also the
 * more sensitive field (it changes the user's login identity), so ordering
 * it last means a failed email update never leaves a half-applied write
 * more consequential than a harmless displayName rename. This is the same
 * "not a single atomic transaction" tradeoff this route already made for
 * displayName+isActive; a true multi-field transaction is a follow-up if it
 * ever becomes worth the complexity.
 *
 * No DELETE handler exists on this route — deleting users is out of scope
 * this sprint (isActive is a soft, reversible toggle only).
 *
 * userService.setActive enforces the two safety rules (never disable
 * yourself, never disable the last active Owner) — this route only maps
 * whatever it throws to the right HTTP status/body.
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
  console.error('[PATCH /api/admin/users/[id]]', error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function PATCH(request, { params }) {
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

  if (body && typeof body === 'object' && 'role' in body) {
    return NextResponse.json({ error: 'Changing role is not supported.' }, { status: 400 });
  }

  const hasDisplayName = typeof body?.displayName === 'string';
  const hasEmail = typeof body?.email === 'string';
  const hasIsActive = typeof body?.isActive === 'boolean';

  if (!hasDisplayName && !hasEmail && !hasIsActive) {
    return NextResponse.json(
      { error: 'Nothing to update — provide displayName, email, and/or isActive.' },
      { status: 400 }
    );
  }

  try {
    let user;
    if (hasDisplayName) {
      user = await userService.updateDisplayName(id, body.displayName, { actorRole: session.role });
    }
    if (hasEmail) {
      user = await userService.updateEmail(id, body.email, { actorRole: session.role });
    }
    if (hasIsActive) {
      user = await userService.setActive(id, body.isActive, {
        actorId: session.userId,
        actorRole: session.role,
      });
    }
    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    return serviceErrorResponse(error, 'Failed to update user.');
  }
}
