/*
 * Prisma client singleton — Admin Panel Architecture v1.2, Section 1.
 *
 * Standard Next.js pattern: in dev, Next's hot-reload re-executes modules
 * on every change, which would otherwise create a new PrismaClient (and a
 * new DB connection pool) on every save. Caching the instance on
 * `globalThis` survives the reload and avoids exhausting connections.
 *
 * UPDATE (database-deferred bridge): the database phase has been
 * intentionally postponed, so `DATABASE_URL` is not set in this
 * environment. `new PrismaClient()` validates its datasource URL eagerly
 * at construction time, so constructing it unconditionally at module load
 * would throw the instant this file is imported — which it now is,
 * transitively, by the admin talent pages (Sprint 4.1/4.2) via the
 * repository layer. That import-time throw is what broke `next build`
 * (and any Vercel Preview build), since those pages are statically
 * prerendered and therefore execute this module during the build.
 *
 * Fix: only construct the real PrismaClient when DATABASE_URL is present.
 * `isDatabaseConfigured` lets callers (currently just the two admin talent
 * pages) check this before touching the repository/engine layer and show
 * a "Database not configured yet" placeholder instead of erroring. The
 * repository files themselves are unchanged — they still do
 * `import { prisma } from '../db'` and call methods on it exactly as
 * before; they simply won't be called yet when no database is configured.
 * Once a real DATABASE_URL is set, this file requires no further changes.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

export const prisma = isDatabaseConfigured
  ? globalForPrisma.__adminPrisma ??
    new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    })
  : null;

if (isDatabaseConfigured && process.env.NODE_ENV !== 'production') {
  globalForPrisma.__adminPrisma = prisma;
}

export default prisma;
