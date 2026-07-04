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

Sprint 3.4 (Approval and Publish, Section 13.5/13.8) added:

- `engine/publishService.js` — `publish(adapter, { parentId, versionId, actorId, basedOnRevisionNumber, correlationId })`, the only code path in the system that ever sets a version's status to PUBLISHED (Section 13.5). Validates the version is PROPOSED, delegates the actual atomic write to `adapter.publishVersion()`, and emits `VersionPublished` only on success. On a revision conflict it re-throws the repository's tagged error as a structured `{ conflict, currentRevisionNumber, basedOnRevisionNumber }` shape consistent with `conflictService`'s early check, without itself doing a separate read-then-write — the authoritative check happens inside the repository's own transaction (Section 13.8).
- `engine/approvalService.js` — `approve()` calls `publishService.publish()` first and only emits `ProposalApproved` if that succeeds, so the Event stream can never show an approval without a matching publish (the v1 composition decided in Section 13.5). `reject()` requires a `rejectionNote`, validates the version is PROPOSED, flips it via `adapter.rejectVersion()`, and emits `ProposalRejected`.
- `engine/adapters/adapterContract.js` — `REQUIRED_ADAPTER_METHODS` gained `publishVersion` and `rejectVersion`, documented as literal gap-fills the same way `submitVersion` was in Sprint 3.3.
- `engine/adapters/talentAdapter.js` — gained `publishVersion`/`rejectVersion`, pure translation to the new repository primitives below; makes no decision of its own.
- `repository/talentRepository.js` — gained `publishTalentVersion` (a single `prisma.$transaction` that compares the live `revisionNumber` against an expected value, throws a tagged `REVISION_CONFLICT_ERROR_CODE` error to abort the transaction if stale, otherwise supersedes the prior published version, publishes the target version with `approvedById`/`approvedAt`, repoints `Talent.currentPublishedVersionId`, and increments `Talent.revisionNumber`) and `setTalentVersionRejection` (single-row status + `rejectionNote` update). Named distinctly from the pre-existing `approveTalentVersion`/`rejectTalentVersion` Phase 4/5 stubs to avoid a collision while that reconciliation remains a Phase 4 decision.
- `constants/enums.js` — gained `REVISION_CONFLICT_ERROR_CODE`, the shared string tag a repository throws and `publishService` recognizes, kept outside `lib/admin/engine/` specifically so a repository can throw it without importing the engine layer (Section 13.15).

No schema changes this sprint — `TalentVersion.approvedById`/`approvedAt`/`rejectionNote` already exist in `prisma/schema.prisma`.

Sprint Phase 2 (Agency Workflow) added:

- `mock-workflow.js` — local, hardcoded mock data for the new `/admin/my-work` page (`app/admin/my-work/page.jsx`). Exports `WORKFLOW_STATUS`, `STATUS_LABEL`, `STATUS_TONE`, and `getWorkflowSections()`. Deliberately not wired to the engine/repository layers above — no database, no Prisma, per this sprint's explicit scope — but its status keys (`draft`, `waiting_for_approval`, `changes_requested`, `approved`, `published`) are named to map cleanly onto real Proposal/Version statuses later, so swapping this file's exports for a real query shouldn't require touching the page's JSX.

Nothing in this folder (other than `mock-workflow.js`, which is plain local data) is wired into any route, page, or component yet.
