/*
 * GET/POST /api/admin/clients — Sprint 7B (Clients & Brands Foundation).
 *
 * OWNER and EMPLOYEE may list and create clients (requireOwnerOrEmployee
 * is the first, independent auth gate in addition to proxy.js's
 * /api/admin/* session check; clientService's own assertActorMayManage is
 * the second — the same defense-in-depth pattern as the users routes).
 * Archive is NOT here — it has its own OWNER-only route
 * (./[id]/archive/route.js).
 *
 * GET  -> { clients: [...] } — ACTIVE by default; ?includeArchived=1 adds
 *         archived rows. Each row carries `_count.brands` = ACTIVE brand
 *         count for the list column.
 * POST -> creates a client. Body: { name, contactName?, contactEmail?,
 *         contactPhone?, notes? }. Validation errors come back with the
 *         friendly Hebrew messages clientService produced (he.clients.
 *         errors), passed through untranslated.
 */

import { NextResponse } from 'next/server';
import { requireOwnerOrEmployee } from '@/lib/admin/auth/authorize';
import { clientService } from '@/lib/admin/clientService';
import { buildRequestAuditContext } from '@/lib/admin/requestAuditContext';
import { he } from '@/lib/admin/i18n/he';
// Website CMS Focus Cleanup — shared module-retirement gate. Additional
// boundary layered ABOVE the existing auth/service checks (not a
// replacement): every handler returns a uniform 404 with no data.
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
  console.error('[api/admin/clients]', error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function GET(request) {
  const retired = retiredModuleApiResponse();
  if (retired) return retired;

  let session;
  try {
    session = await requireOwnerOrEmployee(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  const includeArchived =
    new URL(request.url).searchParams.get('includeArchived') === '1';

  try {
    const clients = await clientService.listClients(
      { includeArchived },
      { actorRole: session.role }
    );
    return NextResponse.json({ clients }, { status: 200 });
  } catch (error) {
    return serviceErrorResponse(error, he.clients.errors.serverError);
  }
}

export async function POST(request) {
  const retired = retiredModuleApiResponse();
  if (retired) return retired;

  let session;
  try {
    session = await requireOwnerOrEmployee(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: he.clients.errors.invalidBody }, { status: 400 });
  }

  const { correlationId, requestMetadata } = buildRequestAuditContext(request);

  try {
    const client = await clientService.createClient(
      {
        name: body?.name,
        contactName: body?.contactName,
        contactEmail: body?.contactEmail,
        contactPhone: body?.contactPhone,
        notes: body?.notes,
      },
      { actorId: session.userId, actorRole: session.role, correlationId, requestMetadata }
    );
    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error, he.clients.errors.serverError);
  }
}
