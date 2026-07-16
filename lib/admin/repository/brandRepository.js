/*
 * Brand repository — Sprint 7B (Clients & Brands Foundation).
 *
 * Thin, decision-free data access for the `brands` table. Same layering,
 * transactional-uniqueness mechanism, and archive semantics as
 * clientRepository (see that file's header) — the only difference is the
 * uniqueness scope: a Brand's normalizedName is unique WITHIN its Client
 * ((clientId, normalizedName) composite, archived rows included), while
 * the same brand name under a different Client is legitimate.
 */

import { prisma } from '../db';
import {
  LIFECYCLE_STATUS,
  BRAND_NAME_CONFLICT_ERROR_CODE,
} from '../constants/enums';

function isUniqueViolation(err) {
  return err && err.code === 'P2002';
}

function nameConflictError() {
  const err = new Error(
    '[brandRepository] normalizedName already in use by another brand of the same client.'
  );
  err.code = BRAND_NAME_CONFLICT_ERROR_CODE;
  return err;
}

export const brandRepository = {
  /** Fetch one brand by id (with its parent client's id/name/status for service checks). Null when absent. */
  async getById(brandId) {
    if (!brandId) return null;
    return prisma.brand.findUnique({
      where: { id: brandId },
      include: {
        client: { select: { id: true, name: true, status: true } },
      },
    });
  },

  /**
   * Create a brand under a client. Transactional check-then-create on the
   * (clientId, normalizedName) composite — archived rows included — with
   * the composite unique index as the race backstop. Throws a
   * BRAND_NAME_CONFLICT-coded error either way. Client existence/state
   * checks belong to clientService, not here.
   */
  async createBrand({ clientId, name, normalizedName, notes }) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.brand.findUnique({
          where: {
            clientId_normalizedName: { clientId, normalizedName },
          },
          select: { id: true },
        });
        if (existing) throw nameConflictError();

        return tx.brand.create({
          data: {
            clientId,
            name,
            normalizedName,
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
   * Update a brand's editable fields (name/normalizedName/notes). Same
   * transactional uniqueness as createBrand, excluding the row itself.
   * `clientId` is the brand's EXISTING client — Sprint 7B has no
   * move-brand-between-clients operation, so it is never updated here.
   */
  async updateBrand(brandId, clientId, data) {
    if (!brandId) return null;
    try {
      return await prisma.$transaction(async (tx) => {
        if (data.normalizedName) {
          const existing = await tx.brand.findUnique({
            where: {
              clientId_normalizedName: {
                clientId,
                normalizedName: data.normalizedName,
              },
            },
            select: { id: true },
          });
          if (existing && existing.id !== brandId) throw nameConflictError();
        }
        return tx.brand.update({ where: { id: brandId }, data });
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw nameConflictError();
      throw err;
    }
  },

  /**
   * Archive a brand: status → ARCHIVED + deletedAt/deletedBy attribution
   * stamp (same convention as clientRepository.archiveClient). Never
   * deletes; no unarchive this sprint.
   */
  async archiveBrand(brandId, archivedByUserId) {
    if (!brandId) return null;
    return prisma.brand.update({
      where: { id: brandId },
      data: {
        status: LIFECYCLE_STATUS.ARCHIVED,
        deletedAt: new Date(),
        deletedBy: archivedByUserId ?? null,
      },
    });
  },
};

export default brandRepository;
