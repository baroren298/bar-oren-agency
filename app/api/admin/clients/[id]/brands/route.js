/*
 * POST /api/admin/clients/[id]/brands — Sprint 7B (Clients & Brands
 * Foundation).
 *
 * OWNER and EMPLOYEE. Creates a brand under the client in the URL. Body:
 * { name, notes? }. clientService enforces: parent client exists and is
 * ACTIVE, brand name unique within the client after normalization
 * (archived brands included; the same name under a different client is
 * legitimate). Brand edit/archive live under /api/admin/brands/[id]/*.
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
  console.error('[api/admin/clients/[id]/brands]', error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function POST(request, { params }) {
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

  const { correlationId, requestMetadata } = buildRequestAuditContext(request);

  try {
    const brand = await clientService.createBrand(
      id,
      { name: body?.name, notes: body?.notes },
      { actorId: session.userId, actorRole: session.role, correlationId, requestMetadata }
    );
    return NextResponse.json({ brand }, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error, he.clients.errors.serverError);
  }
}
