# Production Readiness Review — bar-oren-agency

**Reviewer role:** Senior Staff Engineer (operational readiness, not security)
**Date:** 2026-07-13
**Scope:** Deployment, operations, resilience, and support readiness for production launch. Security findings from prior audits are assumed known and excluded.

**Context (evidence-based):** Next.js app deployed on Vercel; managed Postgres (Neon) with separate dev/prod database branches; versioned Prisma migrations; blob storage adopted for uploads; unit test suite present; extensive internal design documentation; no CI pipeline configuration, no error-reporting or monitoring tooling, no runbook or README found.

---

## 1. Findings by Classification

### Category 1 — Must complete before production

**1.1 Restore a working database migration workflow**
- **Why:** The migration tooling is currently non-functional in the development environment (a required direct database connection setting is missing, and known schema drift exists in the dev database). Until fixed, no schema change can be safely authored or verified.
- **Business impact:** Blocks all future feature work that touches data. Launching with a broken change pipeline means the first post-launch schema change becomes an emergency.
- **Operational impact:** No reliable path from schema change → tested migration → production apply.
- **Effort:** Small.

**1.2 Define and document the production migration procedure**
- **Why:** Migrations exist and some are hand-authored, but there is no documented, repeatable step for applying them to production (who runs the deploy command, when, and how it's verified). No automation ties migrations to app deploys.
- **Business impact:** A deploy that ships code expecting a schema change that was never applied causes an outage on the public site.
- **Operational impact:** Currently depends on one person's memory. High bus-factor risk.
- **Effort:** Small.

**1.3 Error reporting**
- **Why:** No error-tracking service is integrated. Production failures (server errors, failed uploads, broken admin actions) will be invisible unless a user reports them.
- **Business impact:** A broken contact form or talent page could silently lose business for days.
- **Operational impact:** Debugging production issues without error capture means reproducing blind.
- **Effort:** Small.

**1.4 Uptime monitoring and basic alerting**
- **Why:** No evidence of any uptime check or alert channel. Unable to assess from the available information whether anything is configured at the platform level.
- **Business impact:** The site being down is discovered by clients, not by the operator.
- **Operational impact:** No detection → no response. A simple external uptime check with email/phone alerting is the minimum bar.
- **Effort:** Small.

**1.5 Verify backup and recovery for the production database**
- **Why:** The database provider offers point-in-time recovery, but retention depends on plan tier. Unable to assess from the available information what the actual retention window is, and no restore procedure has ever been documented or rehearsed.
- **Business impact:** Talent data, versions, and audit history are the business's core asset. An unrecoverable data loss is existential for the product.
- **Operational impact:** A restore attempted for the first time during an incident is the worst time to learn the procedure.
- **Effort:** Small (verify + document); Medium if a restore rehearsal is included (recommended).

**1.6 Confirm storage architecture for uploads is fully on managed blob storage**
- **Why:** The project has adopted a managed blob storage provider, but a local uploads folder also exists in the project. On a serverless platform, locally written files are ephemeral and lost on redeploy. It must be confirmed that no production code path writes uploads to local disk.
- **Business impact:** Silently disappearing talent images after a deploy would look like data loss to admins and damage trust in the tool.
- **Operational impact:** Intermittent, hard-to-diagnose "missing image" reports.
- **Effort:** Small (verification and cleanup).

**1.7 Automated quality gate before deploy (CI)**
- **Why:** A test suite and linting exist, but no CI configuration was found — nothing enforces that tests pass before code reaches production. If deploys are triggered by pushing to the main branch, an untested change goes straight to the live site.
- **Business impact:** Regression risk on every deploy; the public site is the test environment.
- **Operational impact:** No safety net; rollbacks become the primary quality mechanism.
- **Effort:** Small–Medium.

### Category 2 — Recommended before public launch

**2.1 Documented rollback strategy (app + database)**
- **Why:** The hosting platform supports instant rollback to a previous deployment, but this only works if database changes are backward-compatible. No policy exists for writing migrations in an expand/contract style, and no rollback steps are written down.
- **Business impact:** Turns a 5-minute recovery into a multi-hour incident.
- **Operational impact:** Rollback decisions made ad hoc under pressure.
- **Effort:** Small.

**2.2 Operational runbook**
- **Why:** No README or ops documentation exists. Rich design/spec documents exist, but nothing answers: how to deploy, required environment variables per environment, how to create/recover the owner account (a script exists but is undocumented), what to do when the site is down.
- **Business impact:** Operations are locked to one person; any handoff, vacation, or emergency involving someone else fails.
- **Operational impact:** Every operational task is re-derived from memory.
- **Effort:** Medium.

**2.3 Environment variable inventory and parity check**
- **Why:** An example environment file exists (good), but unable to assess from the available information whether the production environment has all required values set and correct. A missing production variable is a classic launch-day failure.
- **Business impact:** Broken launch day.
- **Operational impact:** One-time checklist; cheap insurance.
- **Effort:** Small.

**2.4 Structured logging conventions**
- **Why:** No logging strategy is evident. Platform logs exist by default but are unstructured and short-lived.
- **Business impact:** Slower incident diagnosis; inability to answer "what happened" for admin actions.
- **Operational impact:** Define what gets logged (admin mutations, auth events, upload failures) and where logs are retained.
- **Effort:** Medium.

**2.5 Preview/staging deployment discipline**
- **Why:** The platform provides preview deployments and the database has a dev branch — the raw materials for a staging flow exist. Unable to assess from the available information whether preview deploys are wired to the dev database branch or accidentally to production.
- **Business impact:** A preview build pointed at production data is a data-corruption risk.
- **Operational impact:** Document which environment each deploy type uses.
- **Effort:** Small.

**2.6 Launch-day smoke checklist**
- **Why:** A short manual checklist (public pages load in both locales, admin login works, image upload works, forms submit) run after every deploy catches what tests miss.
- **Business impact:** Catches embarrassing public breakage within minutes instead of days.
- **Operational impact:** Near-zero ongoing cost.
- **Effort:** Small.

### Category 3 — Can safely wait until later

**3.1 Advanced observability (dashboards, tracing, performance metrics)** — Valuable at scale; overkill for a single-operator agency site at launch. Effort: Medium.

**3.2 Load testing** — Traffic profile is a marketing site plus a small admin panel on auto-scaling serverless infrastructure; load risk is low. Effort: Medium.

**3.3 Formal on-call / escalation process** — With one operator, basic alerting (1.4) covers this. Formalize if the team grows. Effort: Small.

**3.4 Infrastructure-as-code / config export** — Platform settings are currently click-configured. Periodically exporting/documenting settings is sufficient for now. Effort: Medium.

**3.5 Data lifecycle jobs (old asset versions, stale drafts cleanup)** — The versioning model will accumulate data slowly; storage costs are trivial at this scale. Effort: Medium.

**3.6 Scheduled restore drills** — After the first documented restore (1.5), repeating annually is enough. Effort: Small.

### Category 4 — Already satisfactory

**4.1 Environment separation**
- **Why satisfactory:** Separate dev/prod database branches, separate local env files, and a maintained example env file. This is a clean baseline many small projects lack.

**4.2 Managed infrastructure baseline**
- **Why satisfactory:** Serverless hosting plus a managed Postgres provider delegates hardware resilience, TLS, CDN, and scaling to vendors. Appropriate architecture for this product's size.

**4.3 Versioned, ordered migration history**
- **Why satisfactory:** Nine sequenced migrations with a lock file show disciplined schema evolution. (The workflow being currently blocked is item 1.1; the history itself is healthy.)

**4.4 Test suite exists and is colocated with modules**
- **Why satisfactory:** Unit tests across core admin logic indicate a testing culture; the gap is enforcement (1.7), not coverage philosophy.

**4.5 Operational scripts for bootstrap and data import**
- **Why satisfactory:** Owner-creation, dev seeding, and a data importer script exist and are wired into the package scripts. They need documentation (2.2), not new work.

**4.6 Internal design documentation**
- **Why satisfactory:** Unusually thorough architecture/UX/migration planning documents. Maintainability of intent is strong; the missing piece is operational (runbook) documentation, covered in 2.2.

---

## 2. Overall Production Readiness Score

**58 / 100**

The build side is in good shape: clean environment separation, managed infrastructure, disciplined migrations, real tests, strong design docs. The run side is largely absent: no error reporting, no monitoring or alerting, no CI enforcement, an unverified backup story, a currently broken migration workflow, and no operational documentation. Nothing here is architecturally hard — the gap is a set of small, well-understood tasks.

## 3. Top 10 Remaining Launch Risks

1. Production failures are invisible — no error reporting or monitoring (1.3, 1.4).
2. Migration workflow is currently broken; first post-launch schema change is high risk (1.1).
3. Backup retention and restore procedure unverified — potential unrecoverable data loss (1.5).
4. No CI gate — untested code can reach production directly (1.7).
5. Possible local-disk upload path on ephemeral serverless storage — silent image loss (1.6).
6. No documented production migration procedure — schema/code mismatch outage (1.2).
7. Single-person operational knowledge, zero runbook — bus-factor of one (2.2).
8. No rollback policy; migrations may not be backward-compatible with rollback deploys (2.1).
9. Production environment variable completeness unverified — launch-day breakage (2.3).
10. Preview-deploy database wiring unverified — staging traffic could touch production data (2.5).

## 4. Recommended Implementation Order

1. **1.1** Fix migration workflow (unblocks everything schema-related)
2. **1.5** Verify backups + write restore steps (protects against worst case first)
3. **1.6** Confirm blob-only upload path
4. **1.3** Error reporting
5. **1.4** Uptime monitoring + alerting
6. **1.7** CI quality gate
7. **1.2** Production migration procedure
8. **2.3** Env var parity check
9. **2.5** Preview/staging wiring check
10. **2.1** Rollback strategy
11. **2.6** Smoke checklist
12. **2.2** Operational runbook (consolidates outputs of everything above)
13. **2.4** Structured logging

## 5. Production Readiness Sprint (single sprint, ~1 week part-time)

Group items 1.1–1.7 plus 2.1, 2.3, 2.5, 2.6 into one sprint. All are Small (CI is Small–Medium); most are configuration, verification, or documentation rather than development. The sprint's exit criterion: *an error on the live site pages the operator, tests gate every deploy, a database restore has been performed once, and a one-page deploy/rollback procedure exists.*

The runbook (2.2) should be written as the sprint's closing task, capturing what the sprint established.

## 6. Future Roadmap Work

Structured logging (2.4), advanced observability (3.1), load testing (3.2), formal on-call (3.3), infrastructure-as-code (3.4), data lifecycle jobs (3.5), and recurring restore drills (3.6). None block launch; revisit when traffic, team size, or admin usage grows.

---

*Items marked "unable to assess" (backup retention, platform deploy settings, production env completeness, preview-deploy wiring) reflect information not visible from the project itself and should be confirmed in the hosting and database provider dashboards during the sprint.*
