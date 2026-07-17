/*
 * Prisma CLI configuration — Infrastructure Cleanup sprint.
 *
 * Replaces the deprecated `package.json#prisma` block (removed in the same
 * change; Prisma 7 drops support for it entirely — the CLI was printing:
 * "The configuration property `package.json#prisma` is deprecated").
 *
 * IMPORTANT — environment loading: the moment a prisma.config.* file
 * exists, the Prisma CLI stops auto-loading .env files ("Prisma config
 * detected, skipping environment variable loading."). Before this file
 * existed, the CLI auto-loaded ./.env (this repo has no ./prisma/.env),
 * which is where DATABASE_URL / DIRECT_URL live for CLI commands like
 * `prisma migrate dev` / `deploy` / `status`. The loadEnvFile call below
 * replicates exactly that prior behavior using Node's built-in loader
 * (Node >= 20.12; this project runs Node 22). Variables already present in
 * the real environment keep precedence over the file — same as before.
 *
 * Scope: this file is read by the Prisma CLI only. Next.js runtime code
 * never loads it — the generated @prisma/client (lib/admin/db.js) and
 * Next's own .env/.env.local handling are completely unaffected.
 */
import path from 'node:path';
import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  // No ./.env file — fine: env vars may come from the shell/CI instead,
  // exactly like the old CLI behavior when no .env was present.
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
});
