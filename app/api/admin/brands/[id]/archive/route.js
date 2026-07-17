/*
 * POST /api/admin/brands/[id]/archive — Sprint 7B (Clients & Brands
 * Foundation).
 *
 * OWNER ONLY — requireOwner is the first gate, clientService.archiveBrand's
 * assertActorIsOwner the second (defense in depth; UI visibility is never
 * the security boundary). Archive-only: no DELETE, no unarchive this
 * sprint; re-archiving is a 409. The archived brand's name stays reserved
 * within its client.
 */

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin/auth/authorize';
import { clientService } from '@/lib/admin/clientService';
import { buildRequestAuditContext } from '@/lib/admin/requestAuditContext';
import { he } from '@/lib/admin/i18n/he';
// Website CMS Focus Cleanup — shared module-retirement gate (additional
// boundary above the existing OWNER-only auth/service checks).
import { retiredModuleApiResponse } from '@/lib/admin/retired-modules';

function authErrorResponse(error) {
  return NextResponse.json(
    {
      error:
        error.statusCode === 403
          ? he.clients.errors.archiveOwnerOnly
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
  console.error('[api/admin/brands/[id]/archive]', error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function POST(request, { params }) {
  const retired = retiredModuleApiResponse();
  if (retired) return retired;

  let session;
  try {
    session = await requireOwner(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: he.clients.errors.invalidBody }, { status: 400 });
  }

  const { correlationId, requestMetadata } = buildRequestAuditContext(request);

  try {
    const brand = await clientService.archiveBrand(id, {
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
