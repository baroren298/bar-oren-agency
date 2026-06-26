# `components/admin/`

Admin-only UI components (Admin Panel Architecture v1.2, Section 7). Kept deliberately separate from `components/{home,about,contact,talent,layout,common,ui}/**` so admin-only code never gets bundled into the public site, and so the public component tree stays untouched and reusable for Live Preview later (Phase 8) — Live Preview renders the *real* public components against proposed data rather than a separate mockup tree, so this folder is for admin chrome (proposal diff views, dual-state panels, approval controls, etc.), not duplicates of public talent/page components.

**Admin Design System Foundation sprint added** the first six reusable components, plus a shared token file:

- `admin-tokens.module.css` — a `.tokens` CSS-module class carrying the admin palette/spacing as custom properties (mirrors `app/admin/admin-shell.module.css`'s tokens but is independent from it). Each component below composes `.tokens` on its own root element so it renders correctly even outside `<AdminShell>`.
- `PageHeader.jsx` — page title + optional description + optional right-aligned action slot.
- `Card.jsx` — generic bordered surface panel, optional heading.
- `PrimaryButton.jsx` — solid accent-colored button/link for the main action on a page.
- `SecondaryButton.jsx` — outlined, lower-emphasis button/link.
- `StatusBadge.jsx` — small color-coded pill for a status/lifecycle label (`tone`: neutral/success/warning/info/danger). Carries no business logic about what a status means — the caller decides the tone.
- `EmptyState.jsx` — simple "nothing here yet" placeholder with optional action.

Each is a plain presentational component (no `"use client"`, no hooks) so it can be rendered from Server Components — every admin page today is one — or Client Components alike. None of them touch auth, Prisma, or routing; they are pure UI. Demonstrated so far only on `app/admin/page.jsx` (the Dashboard); intended to be reused as-is by Talent, Proposals, SEO, Media, Settings, and any other admin page added later per `ADMIN_PANEL_PLAN.md`.
