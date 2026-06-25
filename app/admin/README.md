# `app/admin/`

Placeholder folder for the admin panel UI (Admin Panel Architecture v1.2, Section 2).

**Nothing here yet on purpose.** Phase 1 (Foundations) only sets up non-route infrastructure (Prisma schema, repository skeletons, shared constants, mapper skeletons under `lib/admin/`). No `page.jsx`, `layout.jsx`, or other route files exist in this folder yet, so this folder currently contributes no routes and has no effect on the public site.

Planned contents, added starting in later phases per `ADMIN_PANEL_PLAN.md` Section 9:

- `login/page.jsx` — Owner authentication (Phase 2)
- `page.jsx` — dashboard (Phase 4+)
- `talent/page.jsx`, `talent/[id]/page.jsx`, `talent/new/page.jsx` (Phase 4)
- `proposals/page.jsx`, `proposals/[id]/page.jsx` (Phase 5)
- `site/`, `site/seo/`, `site/legal/`, `collaborations/page.jsx`, `socials/page.jsx` (Phase 7)
- `preview/talent/[id]/page.jsx` (Phase 8)
- `history/page.jsx`, `trash/page.jsx` (Phase 5 / Section 5)
- `migration/` — internal Migration Day tool, locked down after use (Phase 10)

The `/admin` and `/admin/:path*` rewrite passthrough is already in place in `next.config.mjs` so routes added here will resolve correctly once they exist.
