/*
 * Client repository — Sprint 7B (Clients & Brands Foundation).
 *
 * Thin, decision-free data access for the `clients` table (internal
 * operational records, outside the Draft → Proposed → Published engine —
 * same layering as userRepository). All business rules (validation, role
 * re-assertion, Hebrew errors, event emission) live in
 * lib/admin/clientService.js; this module owns only query mechanics and
 * the TRANSACTIONAL uniqueness mechanism (check-then-write inside one
 * prisma.$transaction, the same convention as
 * talentRepository.publishTalentVersion's slug check), with the DB unique
 * constraint as the race-proof backstop (P2002 → the same coded error).
 *
 * Archive semantics (confirmed Sprint 7B rules): archive-only, no hard
 * delete, no unarchive. Archiving flips status to ARCHIVED and stamps the
 * schema's existing soft-delete attribution fields (deletedAt/deletedBy) —
 * they are the repository convention's "who/when" stamp for any
 * lifecycle removal, and Client has no separate archivedAt/archivedBy
 * columns by design (smallest valid schema). Archived rows keep their
 * normalizedName reserved: the unique index includes them.
 */

import { prisma } from '../db';
import {
  LIFECYCLE_STATUS,
  CLIENT_NAME_CONFLICT_ERROR_CODE,
} from '../constants/enums';

/** True for Prisma's unique-constraint violation (the DB backstop for our in-transaction pre-check). */
function isUniqueViolation(err) {
  return err && err.code === 'P2002';
}

function nameConflictError() {
  const err = new Error(
    '[clientRepository] normalizedName already in use by another client.'
  );
  err.code = CLIENT_NAME_CONFLICT_ERROR_CODE;
  return err;
}

/**
 * Count of ACTIVE (non-archived) brands per client, selected alongside
 * each list row via Prisma's filtered relation count — one query, no N+1.
 */
const ACTIVE_BRAND_COUNT_SELECT = {
  _count: {
    select: {
      brands: { where: { status: LIFECYCLE_STATUS.ACTIVE } },
    },
  },
};

export const clientRepository = {
  /**
   * List clients, name-ascending, each with its ACTIVE brand count.
   * `includeArchived: false` (the default list view) filters to ACTIVE
   * rows; `true` returns everything so the UI can offer the same
   * archived-visibility toggle other admin lists use.
   */
  async listClients({ includeArchived = false } = {}) {
    return prisma.client.findMany({
      where: includeArchived ? {} : { status: LIFECYCLE_STATUS.ACTIVE },
      include: ACTIVE_BRAND_COUNT_SELECT,
      orderBy: { name: 'asc' },
    });
  },

  /**
   * Fetch one client with ALL its brands (active and archived,
   * name-ascending) for the detail page — the page itself decides how to
   * present archived rows, per the admin's existing visibility patterns.
   * Returns null when the id doesn't exist.
   */
  async getById(clientId) {
    if (!clientId) return null;
    return prisma.client.findUnique({
      where: { id: clientId },
      include: {
        brands: { orderBy: { name: 'asc' } },
      },
    });
  },

  /**
   * Create a client. Transactional check-then-create on normalizedName
   * (archived rows included — the WHERE has no status filter on purpose);
   * throws a CLIENT_NAME_CONFLICT-coded error on collision, whether caught
   * by the pre-check or by the unique index under a genuine race.
   */
  async createClient({ name, normalizedName, contactName, contactEmail, contactPhone, notes }) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.client.findUnique({
          where: { normalizedName },
          select: { id: true },
        });
        if (existing) throw nameConflictError();

        return tx.client.create({
          data: {
            name,
            normalizedName,
            contactName: contactName ?? null,
            contactEmail: contactEmail ?? null,
            contactPhone: contactPhone ?? null,
            notes: notes ?? null,
          },
        });
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw nameConflictError();
      throw err;
    }
  },

  /**
   * Update a client's editable fields. Same transactional uniqueness
   * mechanism as createClient, excluding the row itself (a no-op re-save
   * of a client's own name is never a conflict). Only fields present in
   * `data` are written — callers pass an explicitly constructed object,
   * never a request-body spread.
   */
  async updateClient(clientId, data) {
    if (!clientId) return null;
    try {
      return await prisma.$transaction(async (tx) => {
        if (data.normalizedName) {
          const existing = await tx.client.findUnique({
            where: { normalizedName: data.normalizedName },
            select: { id: true },
          });
          if (existing && existing.id !== clientId) throw nameConflictError();
        }
        return tx.client.update({ where: { id: clientId }, data });
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw nameConflictError();
      throw err;
    }
  },

  /**
   * Archive a client: status → ARCHIVED plus the conventional
   * deletedAt/deletedBy attribution stamp (see header). Never deletes.
   * Idempotence/eligibility decisions (already archived? who may archive?)
   * belong to clientService, not here.
   */
  async archiveClient(clientId, archivedByUserId) {
    if (!clientId) return null;
    return prisma.client.update({
      where: { id: clientId },
      data: {
        status: LIFECYCLE_STATUS.ARCHIVED,
        deletedAt: new Date(),
        deletedBy: archivedByUserId ?? null,
      },
    });
  },
};

export default clientRepository;
