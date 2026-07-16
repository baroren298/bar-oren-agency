/*
 * PATCH /api/admin/brands/[id] — Sprint 7B (Clients & Brands Foundation).
 *
 * OWNER and EMPLOYEE. Rename/edit a brand: { name?, notes? } — explicit
 * field pick, partial. There is deliberately no clientId here: Sprint 7B
 * has no move-brand-between-clients operation, and no GET — brands render
 * inside their client's detail page (no separate brand page). Archived
 * brands are read-only (Hebrew 409 from clientService). Archive lives at
 * ./archive (OWNER-only); no DELETE handler exists.
 */

import { NextResponse } from 'next/server';
import { requireOwnerOrEmployee } from '@/lib/admin/auth/authorize';
import { clientService } from '@/lib/admin/clientService';
import { buildRequestAuditContext } from '@/lib/admin/requestAuditContext';
import { he } from '@/lib/admin/i18n/he';

function authErrorResponse(error) {
  return NextResponse.json(
    {
      error:
        error.statusCode === 403
          ? he.clients.errors.forbidden
          : he.clients.errors.notAuthenticated,
    },
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
  console.error('[api/admin/brands/[id]]', error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function PATCH(request, { params }) {
  let session;
  try {
    session = await requireOwnerOrEmployee(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: he.clients.errors.invalidBody }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: he.clients.errors.invalidBody }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: he.clients.errors.invalidBody }, { status: 400 });
  }

  const fields = {};
  for (const key of ['name', 'notes']) {
    if (key in body) fields[key] = body[key];
  }

  const { correlationId, requestMetadata } = buildRequestAuditContext(request);

  try {
    const brand = await clientService.updateBrand(id, fields, {
      actorId: session.userId,
      actorRole: session.role,
      correlationId,
      requestMetadata,
    });
    return NextResponse.json({ brand }, { status: 200 });
  } catch (error) {
    return serviceErrorResponse(error, he.clients.errors.serverError);
  }
}
