/*
 * Website CMS Focus Cleanup — shared module-retirement gate.
 *
 * Centralized, reversible boundary that makes a business module retired
 * from the Website CMS (Clients, Brands, Campaigns) unavailable through
 * direct page loads and direct API calls, WITHOUT deleting any of its code,
 * data, or the existing auth / authorization / service-layer checks. It is
 * an ADDITIONAL boundary layered on top of those checks, never a
 * replacement — the underlying security in authorize.js / clientService.js
 * is left fully intact.
 *
 * Behavior is deliberately uniform for everyone — OWNER, EMPLOYEE, and
 * unauthenticated alike — and reveals nothing about the module or whether
 * any record exists:
 *   - Pages call blockRetiredModulePage() → renders the standard admin 404
 *     (Next's notFound()), preferred over an auth error so a retired area
 *     simply looks absent.
 *   - API routes return retiredModuleApiResponse() → a single generic 404
 *     JSON body with no record data and no existence signal.
 *
 * To un-retire a module later (My Agency extraction), stop calling these
 * helpers in that module's routes/pages — nothing else changes.
 */

import { notFound } from 'next/navigation';
import { NextResponse } from 'next/server';

export const RETIRED_MODULE_HTTP_STATUS = 404;

// Intentionally generic — identical for every caller so it can't be used to
// probe module or record existence.
export const RETIRED_MODULE_ERROR = 'Not found';

/**
 * Page gate. Renders the standard admin 404 via Next's notFound(), which
 * throws — so any code after the call does not execute.
 */
export function blockRetiredModulePage() {
  notFound();
}

/**
 * API gate. Returns a consistent 404 with no payload beyond a generic
 * message — no client / brand / campaign data, and no record-existence
 * difference between "missing" and "forbidden".
 */
export function retiredModuleApiResponse() {
  return NextResponse.json(
    { error: RETIRED_MODULE_ERROR },
    { status: RETIRED_MODULE_HTTP_STATUS }
  );
}
