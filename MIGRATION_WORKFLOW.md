# Migration Workflow — Prisma + Neon

**Added:** Sprint 6A (Migration Workflow Guardrails), 2026-07-16.
**Scope:** how schema changes are authored, verified, and (eventually) applied. Production execution is explicitly OUT of this sprint and requires separate approval — see the Production section.

Never paste connection strings, hostnames, or branch identifiers into chat tools, issues, or documents. When sharing command output, redact the `Datasource "db": ... at "..."` line Prisma prints.

## Environment files

The Prisma CLI reads the root `.env` (loaded by `prisma.config.ts` and by the guard script — a `prisma.config.*` file disables the CLI's own env auto-loading). Next.js reads `.env` and `.env.local` as usual. Keep database variables consistent between the two files.

Variables (all documented with placeholders in `.env.local.example`):

- `DATABASE_URL` — pooled Neon endpoint. Used by the generated client at runtime.
- `DIRECT_URL` — direct (non-pooled) endpoint for the **same** branch. Used only by Prisma CLI commands.
- `DATABASE_ENV` — explicit, non-secret label. The guard refuses migration commands unless it is exactly `development`. The environment is **never** inferred from a hostname.

Locally, both URLs must target the **Development** branch, and only then may `DATABASE_ENV=development` be set. Production values live exclusively in the hosting provider's environment settings, without `DATABASE_ENV=development`.

## Guarded commands (the only supported way to run migrations)

- `npm run prisma:migrate:status` — read-only; compares applied migrations against `prisma/migrations/`. Cannot modify anything.
- `npm run prisma:verify` — read-only; `prisma validate` (schema only, no database) followed by `prisma migrate status`.
- `npm run prisma:migrate:dev` — authors/applies migrations in Development. Accepts only `--name <name>`, `--create-only`, `--skip-generate`, `--skip-seed` (note: with npm, pass flags after `--`, e.g. `npm run prisma:migrate:dev -- --name add_x --create-only`).
- `npm run prisma:generate` — regenerates the client; no database connection.

All three guarded commands refuse (exit code 2, no values printed) when `DATABASE_ENV` is missing or not `development`. There is deliberately **no** npm alias for `migrate deploy`.

### Automatic client generation (Infrastructure Cleanup follow-up)

`npm run dev` and `npm run build` now run `prisma generate` first via the standard `predev`/`prebuild` lifecycle scripts (CI also runs it explicitly). Generation reads only the schema — no database connection. This prevents the stale-generated-client failures seen after schema changes (Clients & Brands sprint). There is deliberately no `postinstall` hook, to avoid regenerating on every dependency install.

### Development data scripts

`npm run admin:seed-dev-talent` and `npm run admin:migrate-day-import` now apply the same rule as the migration guard: they refuse (exit code 2, before any Prisma client is constructed, no values printed) unless `DATABASE_ENV` is exactly `development`. The label is never inferred from a hostname. `npm run admin:create-owner` is intentionally **not** restricted — it is the only way an Owner account is created and is documented for use on the production host; a Production-safe confirmation design for it is deferred to a later sprint.

## Development setup (once per machine)

1. In the Neon console, confirm which endpoints belong to the Development branch.
2. Put Development `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) in the root `.env`; mirror in `.env.local` for the app.
3. Only after step 2 is confirmed, add `DATABASE_ENV=development` to `.env`.
4. Run `npm run prisma:verify` — expect "schema valid" and "database schema is up to date".

## Authoring a schema change (Development only)

1. Start clean: `npm run prisma:verify` must report no pending migrations.
2. Edit `prisma/schema.prisma`.
3. Generate without applying: `npm run prisma:migrate:dev -- --create-only --name <descriptive_name>`.
4. **Review the generated SQL before applying — mandatory.** Prefer additive changes. If the SQL contains `DROP`, `RENAME TO`, `TRUNCATE`, or a type change you didn't intend, stop and fix the schema instead of accepting it (see ASSET_MODEL_MIGRATION_PLAN.md Section 6 for a worked example).
5. Apply to Development: `npm run prisma:migrate:dev`.
6. Validate, in order: `npm run prisma:verify` (clean status), `npm run test` (full suite), `npm run build`, then manual exercise of affected admin routes against Development.

Hand-authored migrations are **exception-only** from this sprint on (they were previously a workaround for dev-database drift, since resolved). If one is unavoidable, it still gets the same SQL review, is applied with `migrate deploy` semantics only after review, and the reason is recorded in the migration file header — as the existing hand-authored migrations do.

## Forbidden commands and situations

Never run against any environment without explicit prior approval: `prisma db push` (bypasses migration history), `prisma migrate reset` (destroys data), `prisma migrate resolve` (rewrites migration bookkeeping), `prisma db execute` / raw SQL against Production, or any `migrate dev` outside Development. Never edit, rename, or delete an applied migration file — checksums are recorded in the database and will mismatch. Never point local env files at Production, even temporarily.

## Production (outside this sprint — requires explicit approval)

Production migrations will be applied with `prisma migrate deploy`, which only applies pending migration files in order (no drift detection, no generation, no reset). The intended procedure, to be formalized in a later sprint: verify `migrate status` against Production (read-only), run `migrate deploy` **before** deploying app code that depends on the change, then re-check `migrate status` and exercise the app. Until that sprint, any Production migration is a manual, explicitly approved operation — nothing in this repository automates it, on purpose.

## Troubleshooting

**P1001 (can't reach database server):** almost always a stale or wrong `DIRECT_URL` in the root `.env` (this exact failure occurred before Sprint 6A), or the Neon branch endpoint changed / compute is suspended. Re-copy both URLs for the Development branch from the Neon console into `.env` and `.env.local`, then `npm run prisma:verify`. Do not paste URLs anywhere while debugging.

**Drift or checksum warnings from `migrate status` / `migrate dev`:** stop immediately. Do not reset, do not edit historical migrations, do not run `migrate resolve` reflexively. Capture the evidence (`migrate status` output with the datasource line redacted, and `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma`, both read-only), identify what was changed outside the workflow, and decide deliberately: codify legitimate differences in a new forward migration, or remove out-of-band objects manually in the Neon console (Development only). Historic example: Neon's `playing_with_neon` sample table made `migrate dev` unusable until it was dropped from the Development branch.
