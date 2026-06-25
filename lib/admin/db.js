/*
 * Prisma client singleton — Admin Panel Architecture v1.2, Section 1.
 *
 * Standard Next.js pattern: in dev, Next's hot-reload re-executes modules
 * on every change, which would otherwise create a new PrismaClient (and a
 * new DB connection pool) on every save. Caching the instance on
 * `globalThis` survives the reload and avoids exhausting connections.
 *
 * PHASE 1 NOTE: this file is not imported by any route, page, or component
 * yet. It exists so the repository layer (lib/admin/repository/*.js) has
 * something to import once it's actually wired up (Phase 4 onward). The
 * public site (data/*.js, app/[locale]/**) never imports this module and
 * is unaffected by it. Until @prisma/client is installed (`npm install`)
 * and a real DATABASE_URL is set, importing this module will throw at
 * runtime — that's expected and fine, since nothing imports it yet.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__adminPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__adminPrisma = prisma;
}

export default prisma;
