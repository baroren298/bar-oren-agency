/*
 * POST /api/admin/clients/[id]/archive — Sprint 7B (Clients & Brands
 * Foundation).
 *
 * OWNER ONLY — requireOwner(request) is the first, independent gate;
 * clientService.archiveClient's assertActorIsOwner is the second (same
 * defense-in-depth as the users routes). An EMPLOYEE session gets 403
 * from both gates independently; UI visibility of the archive button is
 * never the security boundary.
 *
 * Archive-only lifecycle: no DELETE handler, no unarchive route this
 * sprint. Archiving an already-archived client is a 409.
 */

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin/auth/authorize';
import { clientService } from '@/lib/admin/clientService';
import { buildRequestAuditContext } from '@/lib/admin/requestAuditContext';
import { he } from '@/lib/admin/i18n/he';

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
  console.error('[api/admin/clients/[id]/archive]', error);
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
    return NextResponse.json({ error: he.clients.errors.invalidBody }, { status: 400 });
  }

  const { correlationId, requestMetadata } = buildRequestAuditContext(request);

  try {
    const client = await clientService.archiveClient(id, {
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
