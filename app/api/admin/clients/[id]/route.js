/*
 * GET/PATCH /api/admin/clients/[id] — Sprint 7B (Clients & Brands
 * Foundation).
 *
 * OWNER and EMPLOYEE. GET returns one client with all its brands for the
 * detail page; PATCH applies a partial update ({ name?, contactName?,
 * contactEmail?, contactPhone?, notes? } — only keys present are touched,
 * explicitly picked, never a body spread). Archived clients are read-only
 * (clientService rejects the PATCH with a Hebrew 409). No DELETE handler
 * exists anywhere in this module — archive-only, via the OWNER-only
 * ./archive route.
 */

import { NextResponse } from 'next/server';
import { requireOwnerOrEmployee } from '@/lib/admin/auth/authorize';
import { clientService } from '@/lib/admin/clientService';
import { buildRequestAuditContext } from '@/lib/admin/requestAuditContext';
import { he } from '@/lib/admin/i18n/he';
// Website CMS Focus Cleanup — shared module-retirement gate (additional
// boundary above the existing auth/service checks).
import { retiredModuleApiResponse } from '@/lib/admin/retired-modules';

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
  console.error('[api/admin/clients/[id]]', error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function GET(request, { params }) {
  const retired = retiredModuleApiResponse();
  if (retired) return retired;

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

  try {
    const client = await clientService.getClientDetail(id, { actorRole: session.role });
    return NextResponse.json({ client }, { status: 200 });
  } catch (error) {
    return serviceErrorResponse(error, he.clients.errors.serverError);
  }
}

export async function PATCH(request, { params }) {
  const retired = retiredModuleApiResponse();
  if (retired) return retired;

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

  // Explicit field pick — unknown keys are ignored, lifecycle/identity
  // fields (status, id, normalizedName…) can never be smuggled through.
  const fields = {};
  for (const key of ['name', 'contactName', 'contactEmail', 'contactPhone', 'notes']) {
    if (key in body) fields[key] = body[key];
  }

  const { correlationId, requestMetadata } = buildRequestAuditContext(request);

  try {
    const client = await clientService.updateClient(id, fields, {
      actorId: session.userId,
      actorRole: session.role,
      correlationId,
      requestMetadata,
    });
    return NextResponse.json({ client }, { status: 200 });
  } catch (error) {
    return serviceErrorResponse(error, he.clients.errors.serverError);
  }
}
