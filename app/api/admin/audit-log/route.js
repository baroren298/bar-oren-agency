/*
 * GET /api/admin/audit-log — Administration Sprint 2c (Audit Log module).
 *
 * Owner-only, READ-ONLY: this route deliberately exports GET and nothing
 * else — the Audit Log has no mutation surface at all. requireOwner(request)
 * is the first independent auth gate (on top of proxy.js's /api/admin/*
 * session check); auditLogService's own assertActorIsOwner is the second —
 * the same defense-in-depth pattern as app/api/admin/users/route.js.
 *
 * Query params: ?cursor=<last row id of the previous page> (optional).
 * Response: { entries, nextCursor } — entries are auditLogService's safe
 * DTOs only (allowlisted details, no raw metadata, no connection data, no
 * internal ids beyond the row's own id used as the cursor).
 *
 * Error responses are generic on purpose (sprint security rule: failures
 * must not leak internals) — the real error goes to the server log only.
 */

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin/auth/authorize';
import { auditLogService } from '@/lib/admin/auditLogService';

function authErrorResponse(error) {
  return NextResponse.json(
    {
      error:
        error.statusCode === 403 ? 'Only the Owner may view the audit log.' : 'Not authenticated.',
    },
    { status: error.statusCode || 401 }
  );
}

export async function GET(request) {
  let session;
  try {
    session = await requireOwner(request);
  } catch (error) {
    return authErrorResponse(error);
  }

  const cursor = new URL(request.url).searchParams.get('cursor') || null;

  try {
    const { entries, nextCursor } = await auditLogService.listEntries({
      actorRole: session.role,
      cursor,
    });
    return NextResponse.json({ entries, nextCursor }, { status: 200 });
  } catch (error) {
    if (error.statusCode) {
      return NextResponse.json(
        { error: 'Failed to load the audit log.' },
        { status: error.statusCode }
      );
    }
    console.error('[api/admin/audit-log]', error);
    return NextResponse.json({ error: 'Failed to load the audit log.' }, { status: 500 });
  }
}
