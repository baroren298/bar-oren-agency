/*
 * GalleryService — Gallery Sprint 1.
 *
 * Sibling to lib/admin/engine/socialsService.js — same rationale for
 * existing outside proposalService (Section 13.3's generic engine is built
 * around exactly one "current version" row per parent; TalentGalleryImage,
 * like TalentSocial, is a *list* of independently-versioned rows per
 * talent, each carrying its own versionStatus/basedOnVersionId — see
 * prisma/schema.prisma's TalentGalleryImage doc comment). Same layering
 * rule: no direct Prisma/repository import here — every read/write goes
 * through the `adapter` argument's translation methods (Section 13.16).
 * Reuses the same generic event catalog as socialsService, so Gallery
 * actions get the same AuditLog projection with no auditLogListener
 * changes needed.
 *
 * UPDATED — Gallery Upload Sprint 1 (GALLERY_UPLOAD_SPRINT_1_ARCHITECTURE.md
 * §11): now that POST /api/admin/assets/upload exists, an entry CAN be a
 * brand-new gallery image with no `id`, as long as it carries an
 * `imageAssetId` pointing at an already-uploaded Asset (the upload route's
 * own response). This mirrors socialsService.saveDraft()'s "no id -> insert
 * a brand-new DRAFT with basedOnVersionId: null" case — the difference from
 * socials is narrower than it used to be: a gallery entry still can never
 * be invented with NO backing asset at all (`imageAssetId` is still a
 * required FK on TalentGalleryImage), it just no longer has to be an
 * *existing* gallery row's asset. An entry with neither `id` nor
 * `imageAssetId` is still a validation failure (`MISSING_IMAGE_ID`) — there
 * is still nothing identifiable to save.
 *
 * Gallery lifecycle itself is unchanged: this only adds one new branch to
 * the existing per-image loop below (insert-from-imageAssetId), it does not
 * rewrite the PUBLISHED-clone or DRAFT/PROPOSED-update branches.
 *
 * Validation is intentionally light compared to socialsService's
 * validateSocialAccount — there is no "empty account" failure mode here
 * (the image itself always already exists), just type/shape sanity on the
 * fields an editor can actually change.
 */

import { eventService } from './eventService';
import { EVENT_TYPE } from './eventTypes';
import { VERSION_STATUS, ROLE } from '../constants/enums';
import { he } from '../i18n/he';

/**
 * Defense in depth (OWNER/EMPLOYEE Permission Model Sprint): approve/reject
 * must not rely on route protection (requireOwner) alone — the service
 * layer verifies the actor's role independently, same pattern as
 * approvalService/publishService for TalentVersion.
 */
function assertActorIsOwner(actorRole, action) {
  if (actorRole !== ROLE.OWNER) {
    const err = new Error(
      `[${action}] actorRole "${actorRole}" is not permitted — only OWNER may approve, reject, or publish.`
    );
    err.statusCode = 403;
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }
}

/** Error thrown when one or more images in a saveDraft() payload fail validation. */
export class GalleryValidationError extends Error {
  constructor(details) {
    super(he.gallery.errors.validationSummary);
    this.code = 'VALIDATION_FAILED';
    this.details = details; // [{ index, errors: string[] }]
  }
}

/**
 * Validate one gallery image's editable business fields. Pure function, no
 * I/O — exported separately from saveDraft() the same way
 * validateSocialAccount is, in case a route handler ever needs it standalone.
 *
 * @param {object} image - { id, order, altHe, altEn, position, scale, mobileOrder }
 * @returns {string[]} Hebrew error messages, empty if valid
 */
export function validateGalleryImage(image) {
  const errors = [];
  if (!image || typeof image !== 'object') {
    return [he.gallery.errors.invalidBody];
  }

  if (image.order !== undefined && image.order !== null && !Number.isInteger(image.order)) {
    errors.push(he.gallery.errors.invalidOrder);
  }
  if (
    image.mobileOrder !== undefined &&
    image.mobileOrder !== null &&
    !Number.isInteger(image.mobileOrder)
  ) {
    errors.push(he.gallery.errors.invalidMobileOrder);
  }
  if (
    image.scale !== undefined &&
    image.scale !== null &&
    (typeof image.scale !== 'number' || Number.isNaN(image.scale) || image.scale <= 0)
  ) {
    errors.push(he.gallery.errors.invalidScale);
  }
  if (
    image.position !== undefined &&
    image.position !== null &&
    typeof image.position !== 'string'
  ) {
    errors.push(he.gallery.errors.invalidPosition);
  }

  return errors;
}

export const galleryService = {
  /**
   * Save Draft for the whole proposed gallery-image list in one call. Per
   * image, decides which of two things to do (no "brand-new row" case — see
   * this file's header comment):
   *   1. `id` points at a row that's currently PUBLISHED -> insert a new
   *      DRAFT row cloned from it (`basedOnVersionId` = that published
   *      row's id), carrying its existing `imageAssetId` forward unchanged
   *      — a PUBLISHED row is never edited in place, exactly like
   *      TalentVersion/TalentSocial never are.
   *   2. `id` points at a row that's currently DRAFT or PROPOSED (the
   *      "Editable PROPOSED" pattern) -> update that row's fields in place.
   *
   * Validates every image first and blocks the entire save (no partial
   * writes) if any fails — same atomic-from-the-editor's-point-of-view
   * guarantee socialsService.saveDraft gives.
   *
   * @param {object} adapter - needs getGalleryImageById, insertDraftGalleryImage,
   *   updateGalleryImageFields, entityType (talentAdapter satisfies this)
   * @param {object} params
   * @param {string} params.parentId - the Talent id
   * @param {object[]} params.images - proposed image list from the editor
   * @param {string} params.actorId
   * @returns {Promise<{ images: object[] }>}
   */
  async saveDraft(adapter, { parentId, images, actorId } = {}) {
    if (!parentId) {
      throw new Error('[galleryService.saveDraft] parentId is required.');
    }
    if (!actorId) {
      throw new Error('[galleryService.saveDraft] actorId is required.');
    }
    if (!Array.isArray(images)) {
      throw new Error('[galleryService.saveDraft] images must be an array.');
    }

    const validationFailures = [];
    images.forEach((image, index) => {
      if (!image || (!image.id && !image.imageAssetId)) {
        validationFailures.push({ index, errors: [he.gallery.errors.missingImageId] });
        return;
      }
      const errors = validateGalleryImage(image);
      if (errors.length > 0) {
        validationFailures.push({ index, errors });
      }
    });
    if (validationFailures.length > 0) {
      throw new GalleryValidationError(validationFailures);
    }

    const saved = [];
    for (const image of images) {
      const fields = {
        order: image.order,
        altHe: image.altHe,
        altEn: image.altEn,
        position: image.position,
        scale: image.scale,
        mobileOrder: image.mobileOrder,
      };

      let row;
      let eventType;

      if (!image.id) {
        // Gallery Upload Sprint 1 (§11): brand-new entry attaching an
        // already-uploaded Asset — no existing TalentGalleryImage row to
        // look up, so this skips the getGalleryImageById lookup entirely
        // and goes straight to insert, exactly like
        // socialsService.saveDraft()'s "no id" case.
        row = await adapter.insertDraftGalleryImage(
          { ...fields, imageAssetId: image.imageAssetId },
          { parentId, basedOnVersionId: null, createdById: actorId }
        );
        eventType = EVENT_TYPE.PROPOSAL_CREATED;
        saved.push(row);

        await eventService.emit(eventType, {
          entityType: adapter.entityType,
          entityId: parentId,
          actorId,
          payload: { galleryImageId: row.id, fields },
          metadata: {},
        });
        continue;
      }

      const existing = await adapter.getGalleryImageById(image.id);
      if (!existing || existing.talentId !== parentId) {
        throw new Error(
          `[galleryService.saveDraft] gallery image "${image.id}" not found for this talent.`
        );
      }

      if (existing.versionStatus === VERSION_STATUS.PUBLISHED) {
        row = await adapter.insertDraftGalleryImage(
          { ...fields, imageAssetId: existing.imageAssetId },
          { parentId, basedOnVersionId: existing.id, createdById: actorId }
        );
        eventType = EVENT_TYPE.PROPOSAL_CREATED;
      } else if (
        existing.versionStatus === VERSION_STATUS.DRAFT ||
        existing.versionStatus === VERSION_STATUS.PROPOSED
      ) {
        row = await adapter.updateGalleryImageFields(existing.id, fields);
        eventType = EVENT_TYPE.PROPOSAL_UPDATED;
      } else {
        throw new Error(
          `[galleryService.saveDraft] gallery image "${image.id}" is ` +
            `"${existing.versionStatus}" — only PUBLISHED, DRAFT, or PROPOSED rows can be saved.`
        );
      }

      saved.push(row);

      await eventService.emit(eventType, {
        entityType: adapter.entityType,
        entityId: parentId,
        actorId,
        payload: { galleryImageId: row.id, fields },
        metadata: {},
      });
    }

    return { images: saved };
  },

  /**
   * Submit every DRAFT gallery-image row for a talent to PROPOSED, in one
   * transaction (talentRepository.submitDraftGalleryImagesForTalent, via
   * `adapter.submitDraftGalleryImages`). Mirrors socialsService.submit()
   * exactly, including the `NOTHING_TO_SUBMIT` 409 case.
   *
   * @param {object} adapter - needs submitDraftGalleryImages, entityType
   * @param {object} params
   * @param {string} params.parentId - the Talent id
   * @param {string} params.actorId
   * @returns {Promise<{ images: object[] }>}
   */
  async submit(adapter, { parentId, actorId } = {}) {
    if (!parentId) {
      throw new Error('[galleryService.submit] parentId is required.');
    }
    if (!actorId) {
      throw new Error('[galleryService.submit] actorId is required.');
    }

    const submitted = await adapter.submitDraftGalleryImages(parentId);
    if (!submitted || submitted.length === 0) {
      const error = new Error('[galleryService.submit] no DRAFT gallery images to submit.');
      error.code = 'NOTHING_TO_SUBMIT';
      throw error;
    }

    await eventService.emit(EVENT_TYPE.PROPOSAL_SUBMITTED, {
      entityType: adapter.entityType,
      entityId: parentId,
      actorId,
      payload: { galleryImageIds: submitted.map((row) => row.id) },
      metadata: {},
    });

    return { images: submitted };
  },

  /**
   * Owner Approve/Reject (Gallery) sprint — approve one PROPOSED
   * TalentGalleryImage row and publish it immediately. Mirrors
   * socialsService.approve() exactly, scoped to a single
   * TalentGalleryImage row via `adapter.approveGalleryImage`.
   *
   * @param {object} adapter - needs getGalleryImageById, approveGalleryImage, entityType
   * @param {object} params
   * @param {string} params.parentId - the Talent id
   * @param {string} params.imageId
   * @param {string} params.actorId
   * @param {string} params.actorRole - must be ROLE.OWNER (defense in depth).
   * @returns {Promise<{ image: object }>}
   */
  async approve(adapter, { parentId, imageId, actorId, actorRole } = {}) {
    if (!parentId) {
      throw new Error('[galleryService.approve] parentId is required.');
    }
    if (!imageId) {
      throw new Error('[galleryService.approve] imageId is required.');
    }
    if (!actorId) {
      throw new Error('[galleryService.approve] actorId is required.');
    }
    assertActorIsOwner(actorRole, 'galleryService.approve');

    const existing = await adapter.getGalleryImageById(imageId);
    if (!existing || existing.talentId !== parentId) {
      const error = new Error(
        `[galleryService.approve] gallery image "${imageId}" not found for this talent.`
      );
      error.code = 'NOT_FOUND';
      throw error;
    }
    if (existing.versionStatus !== VERSION_STATUS.PROPOSED) {
      const error = new Error(
        `[galleryService.approve] gallery image "${imageId}" is "${existing.versionStatus}", ` +
          'not PROPOSED — only a PROPOSED proposal can be approved.'
      );
      error.code = 'NOT_PROPOSABLE';
      throw error;
    }

    const image = await adapter.approveGalleryImage(imageId, { approvedById: actorId });

    await eventService.emit(EVENT_TYPE.VERSION_PUBLISHED, {
      entityType: adapter.entityType,
      entityId: parentId,
      actorId,
      payload: { galleryImageId: imageId },
      metadata: {},
    });
    await eventService.emit(EVENT_TYPE.PROPOSAL_APPROVED, {
      entityType: adapter.entityType,
      entityId: parentId,
      actorId,
      payload: { galleryImageId: imageId },
      metadata: {},
    });

    return { image };
  },

  /**
   * Owner Approve/Reject (Gallery) sprint — reject one PROPOSED
   * TalentGalleryImage row with a required `rejectionNote`. Mirrors
   * socialsService.reject() exactly via `adapter.rejectGalleryImage`.
   *
   * @param {object} adapter - needs getGalleryImageById, rejectGalleryImage, entityType
   * @param {object} params
   * @param {string} params.parentId - the Talent id
   * @param {string} params.imageId
   * @param {string} params.actorId
   * @param {string} params.actorRole - must be ROLE.OWNER (defense in depth).
   * @param {string} params.rejectionNote
   * @returns {Promise<{ image: object }>}
   */
  async reject(adapter, { parentId, imageId, actorId, actorRole, rejectionNote } = {}) {
    if (!parentId) {
      throw new Error('[galleryService.reject] parentId is required.');
    }
    if (!imageId) {
      throw new Error('[galleryService.reject] imageId is required.');
    }
    if (!actorId) {
      throw new Error('[galleryService.reject] actorId is required.');
    }
    assertActorIsOwner(actorRole, 'galleryService.reject');
    if (!rejectionNote || !rejectionNote.trim()) {
      const error = new Error(
        '[galleryService.reject] rejectionNote is required (rejection always requires a note).'
      );
      error.code = 'REJECTION_NOTE_REQUIRED';
      throw error;
    }

    const existing = await adapter.getGalleryImageById(imageId);
    if (!existing || existing.talentId !== parentId) {
      const error = new Error(
        `[galleryService.reject] gallery image "${imageId}" not found for this talent.`
      );
      error.code = 'NOT_FOUND';
      throw error;
    }
    if (existing.versionStatus !== VERSION_STATUS.PROPOSED) {
      const error = new Error(
        `[galleryService.reject] gallery image "${imageId}" is "${existing.versionStatus}", ` +
          'not PROPOSED — only a PROPOSED proposal can be rejected.'
      );
      error.code = 'NOT_PROPOSABLE';
      throw error;
    }

    const image = await adapter.rejectGalleryImage(imageId, { rejectionNote });

    await eventService.emit(EVENT_TYPE.PROPOSAL_REJECTED, {
      entityType: adapter.entityType,
      entityId: parentId,
      actorId,
      payload: { galleryImageId: imageId, rejectionNote },
      metadata: {},
    });

    return { image };
  },

  /**
   * Rejected Resubmission Recovery sprint — turn a REJECTED
   * TalentGalleryImage row into a fresh, editable DRAFT. Mirrors
   * socialsService.resumeRejected() exactly, including its lineage rule
   * (basedOnVersionId resolves to the still-PUBLISHED base if one exists,
   * otherwise anchors to the rejected row's own id) — see that method's
   * header comment for the full reasoning, which applies unchanged here.
   * Never updates the REJECTED row itself — a brand-new row is always
   * inserted via `adapter.insertDraftGalleryImage`, carrying the rejected
   * row's own `imageAssetId` forward unchanged (this sprint never
   * reassigns which asset a row points at).
   *
   * @param {object} adapter - needs getGalleryImageById, insertDraftGalleryImage, entityType
   * @param {object} params
   * @param {string} params.parentId - the Talent id
   * @param {string} params.imageId - the REJECTED row's id
   * @param {string} params.actorId
   * @returns {Promise<{ image: object }>}
   */
  async resumeRejected(adapter, { parentId, imageId, actorId } = {}) {
    if (!parentId) {
      throw new Error('[galleryService.resumeRejected] parentId is required.');
    }
    if (!imageId) {
      throw new Error('[galleryService.resumeRejected] imageId is required.');
    }
    if (!actorId) {
      throw new Error('[galleryService.resumeRejected] actorId is required.');
    }

    const rejected = await adapter.getGalleryImageById(imageId);
    if (!rejected || rejected.talentId !== parentId) {
      const error = new Error(
        `[galleryService.resumeRejected] gallery image "${imageId}" not found for this talent.`
      );
      error.code = 'NOT_FOUND';
      throw error;
    }
    if (rejected.versionStatus !== VERSION_STATUS.REJECTED) {
      const error = new Error(
        `[galleryService.resumeRejected] gallery image "${imageId}" is ` +
          `"${rejected.versionStatus}", not REJECTED — only a rejected image can be resumed.`
      );
      error.code = 'NOT_REJECTED';
      throw error;
    }

    let lineageBasedOnVersionId = rejected.id;
    if (rejected.basedOnVersionId) {
      const basis = await adapter.getGalleryImageById(rejected.basedOnVersionId);
      if (basis && basis.versionStatus === VERSION_STATUS.PUBLISHED) {
        lineageBasedOnVersionId = basis.id;
      }
    }

    const seedFields = {
      imageAssetId: rejected.imageAssetId,
      order: rejected.order,
      altHe: rejected.altHe,
      altEn: rejected.altEn,
      position: rejected.position,
      scale: rejected.scale,
      mobileOrder: rejected.mobileOrder,
    };

    const image = await adapter.insertDraftGalleryImage(seedFields, {
      parentId,
      basedOnVersionId: lineageBasedOnVersionId,
      createdById: actorId,
    });

    await eventService.emit(EVENT_TYPE.PROPOSAL_CREATED, {
      entityType: adapter.entityType,
      entityId: parentId,
      actorId,
      payload: { galleryImageId: image.id, fields: seedFields, resumedFromGalleryImageId: imageId },
      metadata: {},
    });

    return { image };
  },
};

export default galleryService;
