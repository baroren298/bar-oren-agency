import { NextResponse } from 'next/server';

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
 * Only this one header is added; everything else about the request is
 * untouched, so this has no effect on any other route or page.
 */
export function middleware(request) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: '/:path*',
};
