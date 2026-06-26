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

Sprint 3.3 (Proposal Engine Foundation, Section 13.3/13.8/13.10) added:

- `engine/adapters/adapterContract.js` — the Section 13.10 contract (`getParent`, `getVersion`, `listVersionsForParent`, `insertProposedVersion`, `submitVersion`, `validate`, `mapToPublicShape`) plus the Section 13.4 capabilities shape, and `assertImplementsAdapterContract()`. `entityType` and `submitVersion` are documented additions beyond 13.10's literal list, needed to implement Section 13.3's DRAFT/submit behavior — see the file's header comment.
- `engine/adapters/talentAdapter.js` — the first real adapter, proving the contract against Talent/TalentVersion. `mapToPublicShape` still throws (Live Preview is a later sprint); everything else is real.
- `engine/conflictService.js` — `checkRevision(adapter, { parentId, basedOnRevisionNumber })`, the pure (no mutation) optimistic-locking comparison from Section 13.8, called non-blockingly from `proposalService.create()`.
- `engine/proposalService.js` — `validate()`, `create()` (always inserts DRAFT, runs the early conflict check, emits `ProposalCreated`), `submit()` (DRAFT → PROPOSED, emits `ProposalSubmitted`). Entity-agnostic — takes an adapter, never imports `talentAdapter` itself.
- `repository/talentRepository.js` — gained thin, decision-free primitives (`getParentTalent`, `getTalentVersionById`, `listTalentVersionsForTalent`, `insertTalentVersion`, `updateTalentVersionStatus`) backing `talentAdapter`. The pre-existing Phase 4/5 stub methods are untouched.

Nothing in this folder is wired into any route, page, or component yet.
