# `app/admin/`

Placeholder folder for the admin panel UI (Admin Panel Architecture v1.2, Section 2).

**Phase 2 (Auth/Security) added:** `layout.jsx` (root layout — required since this folder sits outside `app/[locale]/`, which is the de-facto root for the public site) and `login/page.jsx` + `login/LoginForm.jsx` + `login/login.module.css` (Owner login form, posts to `app/api/admin/auth/login/route.js`).

**Phase 4 foundation sprint added:** `page.jsx` — a minimal `/admin` dashboard landing page (title, welcome line, one nav link to `/admin/talent`). No new auth code was needed: middleware.js already gates every `/admin/*` path except the allow-listed `/admin/login`, so `/admin` is protected by that existing check. The post-login redirect in `login/LoginForm.jsx` now points to `/admin` instead of `/admin/talent`.

**Phase 4 layout/design-system sprint added:** a reusable admin shell — `AdminShell.jsx` (header + sidebar + content wrapper), `AdminNavLinks.jsx` (client, active-link highlight for the two working routes: Dashboard → `/admin`, Talent → `/admin/talent`), `AdminLogoutButton.jsx` (client, posts to the existing `/api/admin/auth/logout` route), and `admin-shell.module.css` (a small, self-contained token set inspired by — but independent from — `css/styles.css`, so admin styling still can't drift the public site). `page.jsx`, `talent/page.jsx`, and `talent/[id]/page.jsx` now import and render inside `<AdminShell>` instead of each supplying their own `<main style={...}>` wrapper; `/admin/login` is untouched and stays shell-less. No auth, Prisma, or middleware changes — purely presentational.

**Known cleanup needed:** an `app/admin/(dashboard)/` folder exists alongside this README from an abandoned first attempt at this sprint (a Next.js route-group version of the same shell). It duplicates `page.jsx` for `/admin`, `/admin/talent`, and `/admin/talent/[id]` and **must be deleted** before running `next build` — Next.js will fail with a duplicate-route error otherwise. It was left in place because file deletion wasn't available in the session that built this; delete the whole `app/admin/(dashboard)/` directory, nothing else needs to change.

Planned contents, added starting in later phases per `ADMIN_PANEL_PLAN.md` Section 9:

- `page.jsx` — dashboard (done: minimal foundation; richer dashboard content still pending)
- `talent/page.jsx`, `talent/[id]/page.jsx`, `talent/new/page.jsx` (Phase 4)
- `proposals/page.jsx`, `proposals/[id]/page.jsx` (Phase 5)
- `site/`, `site/seo/`, `site/legal/`, `collaborations/page.jsx`, `socials/page.jsx` (Phase 7)
- `preview/talent/[id]/page.jsx` (Phase 8)
- `history/page.jsx`, `trash/page.jsx` (Phase 5 / Section 5)
- `migration/` — internal Migration Day tool, locked down after use (Phase 10)

The `/admin` and `/admin/:path*` rewrite passthrough is already in place in `next.config.mjs` so routes added here will resolve correctly once they exist.
