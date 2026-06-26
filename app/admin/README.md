# `app/admin/`

Placeholder folder for the admin panel UI (Admin Panel Architecture v1.2, Section 2).

**Phase 2 (Auth/Security) added:** `layout.jsx` (root layout — required since this folder sits outside `app/[locale]/`, which is the de-facto root for the public site) and `login/page.jsx` + `login/LoginForm.jsx` + `login/login.module.css` (Owner login form, posts to `app/api/admin/auth/login/route.js`). No other admin pages exist yet — `/admin` itself (the dashboard) is intentionally not built until Phase 4, so a logged-in redirect to `/admin` currently 404s. That's expected for this phase.

Planned contents, added starting in later phases per `ADMIN_PANEL_PLAN.md` Section 9:

- `page.jsx` — dashboard (Phase 4+)
- `talent/page.jsx`, `talent/[id]/page.jsx`, `talent/new/page.jsx` (Phase 4)
- `proposals/page.jsx`, `proposals/[id]/page.jsx` (Phase 5)
- `site/`, `site/seo/`, `site/legal/`, `collaborations/page.jsx`, `socials/page.jsx` (Phase 7)
- `preview/talent/[id]/page.jsx` (Phase 8)
- `history/page.jsx`, `trash/page.jsx` (Phase 5 / Section 5)
- `migration/` — internal Migration Day tool, locked down after use (Phase 10)

The `/admin` and `/admin/:path*` rewrite passthrough is already in place in `next.config.mjs` so routes added here will resolve correctly once they exist.
