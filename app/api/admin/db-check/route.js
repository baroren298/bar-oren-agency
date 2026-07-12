/*
 * GET /api/admin/db-check — Sprint: smallest Prisma runtime infrastructure.
 *
 * Owner-only diagnostic endpoint to confirm the Neon Postgres connection is
 * reachable from the deployed/running app, using the existing Prisma
 * singleton (lib/admin/db.js) — no new client instance, no schema/table
 * dependency (`SELECT 1`), no data read or written.
 *
 * Auth: proxy.js already 401s any unauthenticated request under
 * /api/admin/* before this file runs; requireOwner() re-derives the
 * session independently as defense in depth, matching the pattern used by
 * the other admin routes (e.g. app/api/admin/talent/[id]/proposals/route.js).
 *
 * Does not expose DATABASE_URL or any other secret — only a boolean/string
 * status is ever returned.
 */

import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/admin/auth/authorize';
import { prisma, isDatabaseConfigured } from '@/lib/admin/db';

export async function GET(request) {
  try {
    await requireOwner(request);
  } catch (error) {
    return NextResponse.json(
      { error: 'Not authenticated.' },
      { status: error.statusCode || 401 }
    );
  }

  if (!isDatabaseConfigured) {
    return NextResponse.json(
      { connected: false, reason: 'DATABASE_URL not configured.' },
      { status: 200 }
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ connected: true }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/admin/db-check] DB connectivity check failed:', error.message);
    return NextResponse.json(
      { connected: false, reason: 'Query failed. See server logs for details.' },
      { status: 200 }
    );
  }
}
