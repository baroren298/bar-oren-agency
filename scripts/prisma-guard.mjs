#!/usr/bin/env node
/*
 * Prisma migration guard — CLI entry point (Sprint 6A: Migration Workflow
 * Guardrails). See MIGRATION_WORKFLOW.md; decision logic lives in
 * scripts/prisma-guard-core.mjs (kept separate so it's unit-testable
 * without spawning anything).
 *
 * What this does:
 *   1. Loads the root ./.env exactly like prisma.config.ts does (Node's
 *      built-in loader; already-set real environment variables keep
 *      precedence). Values are only placed in the child process's
 *      environment — never printed.
 *   2. Asks the core for a decision based solely on the DATABASE_ENV
 *      label. No hostname or URL is ever inspected here.
 *   3. On approval, runs the Prisma CLI as a child `node` process using
 *      argument ARRAYS (no shell, no string interpolation), inheriting
 *      stdio, and exits with the child's exit code.
 *
 * Invoked via the package.json scripts:
 *   npm run prisma:migrate:status  → status  (read-only)
 *   npm run prisma:migrate:dev     → dev     (Development only)
 *   npm run prisma:verify          → verify  (validate + status, read-only)
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { evaluateGuard, runSteps } from './prisma-guard-core.mjs';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Same convention as prisma.config.ts: the CLI's env lives in ./.env.
// Missing file is fine — vars may already be in the shell environment.
try {
  process.loadEnvFile(path.join(repoRoot, '.env'));
} catch {
  /* no ./.env — intentionally silent */
}

const [command, ...extraArgs] = process.argv.slice(2);

const decision = evaluateGuard({
  command,
  extraArgs,
  databaseEnv: process.env.DATABASE_ENV,
});

if (!decision.ok) {
  console.error(decision.error);
  process.exit(2);
}

// Resolve the local Prisma CLI's JS entry and run it via the current Node
// binary — avoids shells entirely and always uses the repo's own Prisma
// version (6.19.3), not whatever `npx` might fetch.
const require = createRequire(import.meta.url);
let prismaEntry;
try {
  prismaEntry = require.resolve('prisma/build/index.js', { paths: [repoRoot] });
} catch {
  console.error(
    'prisma-guard: could not locate the local Prisma CLI. Run `npm install` first.'
  );
  process.exit(2);
}

const exitCode = await runSteps(decision.steps, (args) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [prismaEntry, ...args], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
    child.on('error', () => {
      // Spawn-level failure (not a Prisma error). Static message only.
      console.error('prisma-guard: failed to launch the Prisma CLI.');
      resolve(2);
    });
    child.on('close', (code) => resolve(code ?? 1));
  })
);

process.exit(exitCode);
