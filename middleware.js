import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/admin/auth/session';

/*
 * app/global-not-found.jsx is a Server Component with no props and no
 * access to usePathname()/params — Next's not-found.js conventions don't
 * pass those in. The standard way to make the originally-requested
 * pathname available to a Server Component is to stamp it onto a request
 * header here, then read it back via headers() in that component.
 *
 * Deliberately reads request.nextUrl.pathname BEFORE the next.config.mjs
 * rewrites are applied (middleware runs ahead of rewrites), so this is
 * the original, public, browser-visible URL — e.g. "/not-existing-page"
 * rather than the internal "/he/not-existing-page". That matches the
 * convention already used by getLocaleFromPathname() in lib/i18n.js
 * (checks for an "/en" prefix on the public URL).
 *
 * This x-pathname stamping is unconditional and unchanged from Phase 1 —
 * applies to every request, public or admin.
 */

/*
 * Admin auth gating — Phase 2: Auth/Security (ADMIN_PANEL_PLAN.md Section
 * 11). Runs on the Edge runtime (Next's middleware default), so it only
 * verifies the already-signed session JWT via `jose` — it never touches
 * bcryptjs or the database. That's also why this only proves "is logged
 * in with a validly signed token," not full per-action role checks; those
 * happen again inside each route/page via lib/admin/auth/authorize.js as
 * the app is built out (Phase 4+).
 *
 * Allow-listed without a session, since these are the auth boundary
 * itself:
 *   - /admin/login        (the login page)
 *   - /api/admin/auth/login   (the login route handler)
 *   - /api/admin/auth/logout  (logging out an already-logged-out session
 *                              is a harmless no-op)
 *
 * Everything else under /admin/* or /api/admin/* requires a valid
 * session: page routes redirect to /admin/login, API routes get a 401
 * JSON response instead of a redirect (a redirect would be the wrong
 * response shape for a fetch() caller).
 */
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/api/admin/auth/login', '/api/admin/auth/logout']);

function isAdminPath(pathname) {
  return pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  if (isAdminPath(pathname) && !PUBLIC_ADMIN_PATHS.has(pathname)) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = await verifySession(token);

    if (!session) {
      if (pathname.startsWith('/api/admin')) {
        return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
      }
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: '/:path*',
};
