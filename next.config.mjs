/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  /*
   * This app has no root app/layout.jsx — app/[locale]/layout.jsx is the
   * de-facto root (it owns <html>/<body>). Next.js docs call this out
   * explicitly as a case where a nested not-found.jsx can't reliably
   * compose a 404 UI (root layout defined via a top-level dynamic
   * segment), and recommend global-not-found.js instead. See
   * app/global-not-found.jsx for the implementation.
   */
  experimental: {
    globalNotFound: true,
  },

  /*
   * Locale routing — Hebrew stays unprefixed at "/", English lives at "/en".
   *
   * Internally every route is implemented once under app/[locale]/, so these
   * rewrites map the public Hebrew URLs (no prefix) to the internal "/he/..."
   * segment. "/en" and "/en/*" need no rewrite — they already match the
   * app/[locale]/ folder structure directly.
   *
   * IMPORTANT: this list must stay in sync with the routes that exist under
   * app/[locale]/. Add a new line here whenever a new top-level Hebrew route
   * is added.
   *
   * The final two rules exist purely for 404 handling. Without them, an
   * unprefixed unknown path like "/not-existing-page" has exactly one
   * non-prefixed segment, which structurally matches the app/[locale]/
   * dynamic segment itself (locale="not-existing-page") — that fails the
   * dynamicParams=false check in app/[locale]/layout.jsx and falls all the
   * way out to Next's generic, non-localized 404 page instead of our
   * Hebrew-aware app/[locale]/not-found.jsx.
   *
   * The "/en" passthrough rules must come before the catch-all (rewrites in
   * this array are tried in order, first match wins) so English paths are
   * never redirected into the Hebrew tree. The catch-all then sends any
   * other unmatched path into "/he/...", where locale="he" validly matches
   * and the nested not-found.jsx renders the localized Hebrew 404 instead.
   */
  async rewrites() {
    return [
      { source: '/', destination: '/he' },
      { source: '/talent', destination: '/he/talent' },
      { source: '/talent/:slug', destination: '/he/talent/:slug' },
      { source: '/about', destination: '/he/about' },
      { source: '/contact', destination: '/he/contact' },
      { source: '/accessibility', destination: '/he/accessibility' },
      { source: '/privacy-policy', destination: '/he/privacy-policy' },
      { source: '/en', destination: '/en' },
      { source: '/en/:path*', destination: '/en/:path*' },
      { source: '/:path*', destination: '/he/:path*' },
    ];
  },
};

export default nextConfig;
