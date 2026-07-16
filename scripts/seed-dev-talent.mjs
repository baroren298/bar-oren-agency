#!/usr/bin/env node
/*
 * DEV-ONLY seed: one minimal published Talent + TalentVersion test record —
 * Sprint 4.3 (ADMIN_PANEL_PLAN.md admin-only manual verification bootstrap).
 *
 * Purpose: /admin/talent and /admin/talent/[id] (Sprint 4.1/4.2) are
 * strictly read-only and have nothing to render until at least one
 * published TalentVersion exists. This script creates exactly one obviously
 * fake, clearly-labeled test record so those two pages can be manually
 * verified locally. It is NOT a seed/fixtures system, NOT the Migration Day
 * import (ADMIN_PANEL_PLAN.md Section 8 — that maps real data/talent.js
 * records and does not exist yet), and NOT wired into any other part of
 * the app.
 *
 * Run manually, locally, after `npm run admin:create-owner`:
 *
 *   npm run admin:seed-dev-talent
 *
 * Safety properties (deliberate, do not relax):
 *   - Never imported or executed by next build/start, by middleware, by any
 *     route, or by CI — it is only ever invoked by a human, by name, from a
 *     terminal. Not referenced anywhere else in the codebase.
 *   - Refuses to run if NODE_ENV=production, even though nothing currently
 *     sets that for this script — defense in depth against ever being
 *     wired into an automated/production path by mistake later.
 *   - Refuses to run if DATABASE_URL is not set (fails safely with a clear
 *     message instead of throwing a raw Prisma connection error), exactly
 *     mirroring lib/admin/db.js's isDatabaseConfigured guard used by the
 *     admin talent pages themselves.
 *   - Creates only obviously-fake data (slug/name explicitly say "dev seed
 *     test talent") — never anything resembling a real agency talent.
 *   - Idempotent: if a record with this script's fixed test slug already
 *     exists, it reports that and exits without creating a duplicate or
 *     touching the existing row.
 *   - Requires an existing Owner user (created by
 *     `npm run admin:create-owner`) to attribute the test record to, since
 *     TalentVersion.createdById is a required field — this script does not
 *     create or modify any User row.
 *
 * Out of scope (per Sprint 4.3 — do not extend this script to do any of
 * this without a separate, explicitly approved sprint):
 *   - No production seeding, no bulk/fixture data, no Migration Day import.
 *   - No proposed/draft versions, no approve/reject flow exercised.
 *   - No image assets, no socials, no gallery rows.
 *   - No writes to data/*.js, no public-site changes.
 *
 * Same reason as scripts/create-owner.mjs for being a plain .mjs file
 * instead of importing lib/admin/* directly: this project's package.json
 * has no "type": "module", so the lib/admin/* files (which use
 * import/export syntax) cannot be loaded by plain Node without that
 * project-wide flag. Bundled npm packages (@prisma/client) resolve their
 * own modules and have no such problem.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Fixed, obviously-fake identifiers — never change these to anything that
// could look like a real talent record.
const TEST_SLUG = 'dev-seed-test-talent';
const TEST_NAME = 'Dev Seed Test Talent (DO NOT USE IN PRODUCTION)';
const TEST_NAME_EN = 'Dev Seed Test Talent (DO NOT USE IN PRODUCTION)';

/*
 * Plain Node doesn't auto-load .env.local the way `next dev` does. Minimal
 * inline loader, same approach as create-owner.mjs — no dotenv dependency
 * needed for one script.
 */
function loadEnvFile(filename) {
  const path = resolve(projectRoot, filename);
  if (!existsSync(path)) return;
  const contents = readFileSync(path, 'utf8');
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[seed-dev-talent] Refusing to run with NODE_ENV=production. ' +
        'This script creates test data only and must never touch a production database.'
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error(
      '[seed-dev-talent] DATABASE_URL is not set. This script requires a local ' +
        'database to seed — set DATABASE_URL in .env.local (see .env.local.example), ' +
        'run `npm run prisma:migrate:dev`, then re-run this script.'
    );
    process.exit(1);
  }

  // Same rule as the migration guard (scripts/prisma-guard-core.mjs):
  // authorization comes ONLY from the explicit, non-secret DATABASE_ENV
  // label — never inferred from a hostname or URL, and no env value is
  // ever printed. Checked BEFORE any PrismaClient is constructed.
  if ((process.env.DATABASE_ENV ?? '').trim() !== 'development') {
    console.error(
      "[seed-dev-talent] DATABASE_ENV is not 'development'. This script " +
        'writes test data and only ever runs against the Development ' +
        'database. Set DATABASE_ENV=development in the root .env once you ' +
        'have confirmed the URLs target the Development branch ' +
        '(see MIGRATION_WORKFLOW.md). Refusing to run.'
    );
    process.exit(2);
  }

  const prisma = new PrismaClient();

  try {
    const existingTalent = await prisma.talent.findUnique({ where: { slug: TEST_SLUG } });
    if (existingTalent) {
      console.log(
        `[seed-dev-talent] Test talent already exists (slug: "${TEST_SLUG}", id: ${existingTalent.id}). ` +
          'Nothing to do.'
      );
      process.exit(0);
    }

    const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });
    if (!owner) {
      console.error(
        '[seed-dev-talent] No Owner user found. Run `npm run admin:create-owner` first, ' +
          'then re-run this script.'
      );
      process.exit(1);
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const talent = await tx.talent.create({
        data: {
          slug: TEST_SLUG,
          status: 'ACTIVE',
        },
      });

      const version = await tx.talentVersion.create({
        data: {
          talentId: talent.id,
          status: 'PUBLISHED',
          name: TEST_NAME,
          nameEn: TEST_NAME_EN,
          category: ['test'],
          tags: ['seed', 'dev-only', 'not-real'],
          featured: false,
          location: 'Test City (seed data)',
          locationEn: 'Test City (seed data)',
          bioHe: 'רשומת בדיקה שנוצרה על-ידי scripts/seed-dev-talent.mjs. לא נתון אמיתי.',
          bioEn: 'Test record created by scripts/seed-dev-talent.mjs. Not real data.',
          createdById: owner.id,
          approvedById: owner.id,
          approvedAt: now,
        },
      });

      const published = await tx.talent.update({
        where: { id: talent.id },
        data: { currentPublishedVersionId: version.id },
      });

      return { talent: published, version };
    });

    console.log(
      `[seed-dev-talent] Created test talent "${result.talent.slug}" ` +
        `(talentId: ${result.talent.id}, versionId: ${result.version.id}, ` +
        `attributed to owner: ${owner.email}).`
    );
    console.log('[seed-dev-talent] Visit /admin/talent locally to verify it renders.');
    process.exit(0);
  } catch (err) {
    console.error('[seed-dev-talent] Failed:', err.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
