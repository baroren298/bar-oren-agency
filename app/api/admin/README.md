# `app/api/admin/`

Placeholder folder for admin API route handlers (Admin Panel Architecture v1.2, Section 1).

**Nothing here yet on purpose.** No `route.js` files exist in this folder yet — Phase 1 (Foundations) only adds the repository layer these routes will eventually call (`lib/admin/repository/*.js`), not the routes themselves.

When routes are added (Phase 2 onward), every one of them must:

- Be gated server-side by auth (`middleware.js` and/or a per-route session check) — never reachable unauthenticated. See `ADMIN_PANEL_PLAN.md` Section 11.
- Call into `lib/admin/repository/*.js` rather than querying Prisma directly.
- Never trust a client-supplied role/permission flag for authorization decisions.

This folder is separate from `app/api/contact/route.js` (the existing, unrelated contact-form endpoint, untouched by the admin work).
