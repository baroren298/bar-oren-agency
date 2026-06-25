# `components/admin/`

Placeholder folder for admin-only UI components (Admin Panel Architecture v1.2, Section 7).

**Nothing here yet on purpose.** Kept deliberately separate from `components/{home,about,contact,talent,layout,common,ui}/**` so admin-only code never gets bundled into the public site, and so the public component tree stays untouched and reusable for Live Preview later (Phase 8) — Live Preview renders the *real* public components against proposed data rather than a separate mockup tree, so this folder is for admin chrome (proposal diff views, dual-state panels, approval controls, etc.), not duplicates of public talent/page components.
