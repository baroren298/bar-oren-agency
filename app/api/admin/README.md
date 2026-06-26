# `app/api/admin/`

Placeholder folder for admin API route handlers (Admin Panel Architecture v1.2, Section 1).

**Phase 2 (Auth/Security) added:** `auth/login/route.js` and `auth/logout/route.js` — the only two routes in this folder that are deliberately reachable without a session (they're the auth boundary itself; see `middleware.js`'s allow-list). Every other route added from here on must be reachable only with a valid session.

When routes are added (Phase 3 onward), every one of them must:

- Be gated server-side by auth (`middleware.js` and/or a per-route session check) — never reachable unauthenticated. See `ADMIN_PANEL_PLAN.md` Section 11.
- Call into `lib/admin/repository/*.js` rather than querying Prisma directly.
- Never trust a client-supplied role/permission flag for authorization decisions.

This folder is separate from `app/api/contact/route.js` (the existing, unrelated contact-form endpoint, untouched by the admin work).
