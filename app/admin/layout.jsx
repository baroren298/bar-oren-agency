/*
 * Admin root layout — Phase 2: Auth/Security.
 *
 * app/admin/ sits outside app/[locale]/, which is the de-facto root layout
 * for the public site (this app has no app/layout.jsx — see
 * app/global-not-found.jsx's header comment for why). Next.js requires
 * every top-level route segment without a shared root layout to supply
 * its own <html>/<body>, so this is that minimal root for everything
 * under /admin.
 *
 * Deliberately self-contained: no import of styles/globals.css or any
 * public component, so admin styling can never accidentally drift the
 * public site and vice versa. `noindex` metadata keeps the admin out of
 * search results regardless of the /admin rewrite passthrough.
 */

export const metadata = {
  title: 'Admin — Bar Oren Agency',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>{children}</body>
    </html>
  );
}
