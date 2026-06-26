# `lib/admin/`

Admin-only server-side code (Admin Panel Architecture v1.2). Not imported by the public site — `data/*.js` and `app/[locale]/**` continue to be the public site's only data sources until Migration Day (Section 8).

Phase 1 (Foundations) contents:

- `db.js` — Prisma client singleton. Not yet connected to a real database; importing it before `npm install` + a real `DATABASE_URL` are configured will throw at runtime, which is expected since nothing imports it yet.
- `constants/enums.js` — plain-JS mirrors of `prisma/schema.prisma`'s enums (`Role`, `VersionStatus`, `LifecycleStatus`, `ActionType`, `EntityType`, `SocialPlatform`), for use without importing the generated Prisma client.
- `repository/` — one file per entity type (`talentRepository.js`, `imageAssetRepository.js`, `siteContentRepository.js`, `seoRepository.js`, `legalPageRepository.js`, `entityRepository.js`, `auditLogRepository.js`, `userRepository.js`). Every method is currently a documented stub that throws — see each file's header comment for which implementation phase (Section 9) fills it in. Route handlers are expected to call these, never Prisma directly.
- `mappers/` — `mapTalentVersionToPublicShape` (implemented) and SEO/SiteContent/LegalPage mapper stubs (not yet implemented), per Section 7 (Live Preview). These translate normalized database rows into the exact object shapes the public site's existing components already expect from `data/*.js`, so Live Preview (Phase 8) and the Migration Day import script (Phase 10) can reuse real public components and a tested mapping instead of building either from scratch later.

Sprint 3.2 (Core Content Engine, Section 13) added:

- `engine/eventService.js` — the only code path permitted to create an `Event` row (`emit()`). Generic/entity-agnostic per Section 13.9.
- `engine/eventTypes.js` — the `EVENT_TYPE` catalog and `isValidEventType()`. Naming convention decided here: generic `<Action>` strings, no entity prefix.
- `engine/listeners/` — the listener registry (`index.js`) `eventService` calls after every `emit()`, plus an `auditLogListener.js` placeholder that is **not yet registered** — full `AuditLog` projection (Section 13.7) is a later sprint.
- `repository/eventRepository.js` — thin Prisma access for the `Event` table, called only by `eventService`.

Nothing in this folder is wired into any route, page, or component yet.
