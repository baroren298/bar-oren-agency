/*
 * SocialsService — Social Links persistence sprint.
 *
 * Why this isn't just `proposalService`: that engine service (Section 13.3)
 * is built around exactly one "current version" row per parent — create()
 * inserts one DRAFT, update() edits that one row, submit() flips that one
 * row DRAFT -> PROPOSED. `TalentSocial` doesn't fit that shape: a talent can
 * have several social accounts, and each row carries its OWN
 * versionStatus/basedOnVersionId (see prisma/schema.prisma's TalentSocial
 * doc comment — it already mirrors TalentVersion's Draft -> Proposed ->
 * Published pattern, just per-row instead of per-parent). Forcing that into
 * proposalService's one-row-per-parent contract would mean either lying
 * about what a "version" is or rewriting the generic engine — neither is
 * "smallest safe change." So this is a small, dedicated, talent-adjacent
 * service that re-implements the same three moves (create/update a Draft,
 * submit a Draft to Proposed) for a *list* of rows in one user action,
 * while still respecting the codebase's layering rules:
 *   - no direct Prisma/repository import here — every read/write goes
 *     through the `adapter` argument's translation methods (Section 13.16:
 *     "adapters own translation, services own business logic"), same
 *     calling convention proposalService.* already uses.
 *   - reuses the existing event catalog (PROPOSAL_CREATED/UPDATED/SUBMITTED,
 *     lib/admin/engine/eventTypes.js) and eventService, so social actions
 *     get the same AuditLog projection every other proposal action already
 *     gets, with no auditLogListener changes needed.
 *
 * Validation lives here (not in talentAdapter.validate, which is
 * TalentVersion-specific and only checks `fields.name`): a social account's
 * "valid" shape — known platform/label, a customLabel when label is OTHER,
 * at least a handle or a url, and a well-formed http(s) url when one is
 * given — has nothing to do with TalentVersion's fields, so it doesn't
 * belong on that adapter method. Unlike proposalService.update() (where
 * validation never blocks Save Draft — an incomplete profile edit is a
 * normal, supported state), saveDraft() below DOES block on validation
 * failures. Reasoning: a social *account* with neither a handle nor a url
 * isn't "incomplete," it's empty — there is nothing for a published card to
 * show — and a malformed url is exactly the case scope item #6 ("clear
 * Hebrew validation errors for invalid/missing social link data") asks to
 * catch before it ever reaches the database, even in Draft form. Blocking
 * the whole save (rather than silently skipping the bad row) keeps the
 * Save Draft network call obviously atomic from the editor's point of view.
 */

import { eventService } from './eventService';
import { EVENT_TYPE } from './eventTypes';
import { VERSION_STATUS, ROLE } from '../constants/enums';
import { SOCIAL_PLATFORMS, SOCIAL_ACCOUNT_LABELS } from '../social-platforms';
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

const VALID_PLATFORM_VALUES = new Set(SOCIAL_PLATFORMS.map((entry) => entry.key.toUpperCase()));
const VALID_LABEL_VALUES = new Set(SOCIAL_ACCOUNT_LABELS.map((entry) => entry.value));

/** Error thrown when one or more accounts in a saveDraft() payload fail validation. */
export class SocialValidationError extends Error {
  constructor(details) {
    super(he.social.errors.validationSummary);
    this.code = 'VALIDATION_FAILED';
    this.details = details; // [{ index, errors: string[] }]
  }
}

/**
 * Validate one social account's business fields. Pure function, no I/O —
 * exported separately from saveDraft() so a route handler could call it
 * standalone if it ever needs to (mirrors proposalService.validate() being
 * exposed apart from create()).
 *
 * @param {object} account - { platform, label, customLabel, handle, url }
 * @returns {string[]} Hebrew error messages, empty if valid
 */
export function validateSocialAccount(account) {
  const errors = [];
  if (!account || typeof account !== 'object') {
    return [he.social.errors.invalidBody];
  }

  if (!account.platform || !VALID_PLATFORM_VALUES.has(account.platform)) {
    errors.push(he.social.errors.invalidPlatform);
  }
  if (!account.label || !VALID_LABEL_VALUES.has(account.label)) {
    errors.push(he.social.errors.invalidLabel);
  }
  if (account.label === 'OTHER' && !(account.customLabel && account.customLabel.trim())) {
    errors.push(he.social.errors.customLabelRequired);
  }

  const handle = account.handle ? String(account.handle).trim() : '';
  const url = account.url ? String(account.url).trim() : '';
  if (!handle && !url) {
    errors.push(he.social.errors.missingHandleOrUrl);
  }
  if (url) {
    let parsed = null;
    try {
      parsed = new URL(url);
    } catch {
      parsed = null;
    }
    if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
      errors.push(he.social.errors.invalidUrl);
    }
  }

  return errors;
}

export const socialsService = {
  /**
   * Save Draft for the whole proposed social-accounts list in one call.
   * Per account, decides which of three things to do — same three cases a
   * Details-tab Draft can be in, just resolved per-row instead of once for
   * the whole parent:
   *   1. no `id` (a brand-new account added via the "+" form) -> insert a
   *      new DRAFT row, `basedOnVersionId: null`.
   *   2. `id` points at a row that's currently PUBLISHED -> insert a new
   *      DRAFT row cloned from it (`basedOnVersionId` = that published
   *      row's id) — a PUBLISHED row is never edited in place, exactly like
   *      TalentVersion never is.
   *   3. `id` points at a row that's currently DRAFT or PROPOSED (the
   *      "Editable PROPOSED" pattern, same widened rule
   *      proposalService.update() already applies to TalentVersion) ->
   *      update that row's fields in place.
   *
   * Validates every account first and blocks the entire save (no partial
   * writes) if any fails — see this file's header comment for why this
   * differs from proposalService.update()'s never-block rule.
   *
   * @param {object} adapter - needs getSocialById, insertDraftSocial,
   *   updateSocialFields, entityType (talentAdapter satisfies this)
   * @param {object} params
   * @param {string} params.parentId - the Talent id
   * @param {object[]} params.accounts - proposed account list from the editor
   * @param {string} params.actorId
   * @returns {Promise<{ accounts: object[] }>}
   */
  async saveDraft(adapter, { parentId, accounts, actorId } = {}) {
    if (!parentId) {
      throw new Error('[socialsService.saveDraft] parentId is required.');
    }
    if (!actorId) {
      throw new Error('[socialsService.saveDraft] actorId is required.');
    }
    if (!Array.isArray(accounts)) {
      throw new Error('[socialsService.saveDraft] accounts must be an array.');
    }

    const validationFailures = [];
    accounts.forEach((account, index) => {
      const errors = validateSocialAccount(account);
      if (errors.length > 0) {
        validationFailures.push({ index, errors });
      }
    });
    if (validationFailures.length > 0) {
      throw new SocialValidationError(validationFailures);
    }

    const saved = [];
    for (const account of accounts) {
      let row;
      let eventType;

      if (account.id) {
        const existing = await adapter.getSocialById(account.id);
        if (!existing || existing.talentId !== parentId) {
          throw new Error(
            `[socialsService.saveDraft] social account "${account.id}" not found for this talent.`
          );
        }

        if (existing.versionStatus === VERSION_STATUS.PUBLISHED) {
          row = await adapter.insertDraftSocial(account, {
            parentId,
            basedOnVersionId: existing.id,
            createdById: actorId,
          });
          eventType = EVENT_TYPE.PROPOSAL_CREATED;
        } else if (
          existing.versionStatus === VERSION_STATUS.DRAFT ||
          existing.versionStatus === VERSION_STATUS.PROPOSED
        ) {
          row = await adapter.updateSocialFields(existing.id, account);
          eventType = EVENT_TYPE.PROPOSAL_UPDATED;
        } else {
          throw new Error(
            `[socialsService.saveDraft] social account "${account.id}" is ` +
              `"${existing.versionStatus}" — only PUBLISHED, DRAFT, or PROPOSED rows can be saved.`
          );
        }
      } else {
        row = await adapter.insertDraftSocial(account, {
          parentId,
          basedOnVersionId: null,
          createdById: actorId,
        });
        eventType = EVENT_TYPE.PROPOSAL_CREATED;
      }

      saved.push(row);

      await eventService.emit(eventType, {
        entityType: adapter.entityType,
        entityId: parentId,
        actorId,
        payload: { socialId: row.id, fields: account },
        metadata: {},
      });
    }

    return { accounts: saved };
  },

  /**
   * Submit every DRAFT social row for a talent to PROPOSED, in one
   * transaction (talentRepository.submitDraftSocialsForTalent, via
   * `adapter.submitDraftSocials`). Mirrors proposalService.submit()'s
   * "DRAFT only" rule — a row that's already PROPOSED is left as-is, not
   * re-submitted. Throws a recognizable `NOTHING_TO_SUBMIT` error if there
   * is nothing DRAFT to submit, so the route can return a clear 409 instead
   * of a misleading 200 with an empty list.
   *
   * @param {object} adapter - needs submitDraftSocials, entityType
   * @param {object} params
   * @param {string} params.parentId - the Talent id
   * @param {string} params.actorId
   * @returns {Promise<{ accounts: object[] }>}
   */
  async submit(adapter, { parentId, actorId } = {}) {
    if (!parentId) {
      throw new Error('[socialsService.submit] parentId is required.');
    }
    if (!actorId) {
      throw new Error('[socialsService.submit] actorId is required.');
    }

    const submitted = await adapter.submitDraftSocials(parentId);
    if (!submitted || submitted.length === 0) {
      const error = new Error('[socialsService.submit] no DRAFT social accounts to submit.');
      error.code = 'NOTHING_TO_SUBMIT';
      throw error;
    }

    await eventService.emit(EVENT_TYPE.PROPOSAL_SUBMITTED, {
      entityType: adapter.entityType,
      entityId: parentId,
      actorId,
      payload: { socialIds: submitted.map((row) => row.id) },
      metadata: {},
    });

    return { accounts: submitted };
  },

  /**
   * Owner Approve/Reject (Social Links) sprint — approve one PROPOSED
   * TalentSocial row and publish it immediately. Mirrors
   * `approvalService.approve()`'s v1 composition (Section 13.5: approve now,
   * publish now) but scoped to a single TalentSocial row via
   * `adapter.approveSocial` instead of the generic `publishService`, since
   * TalentSocial has no parent-wide revisionNumber for `publishService` to
   * check (see talentRepository.approveTalentSocial's header comment).
   * Emits both `VERSION_PUBLISHED` and `PROPOSAL_APPROVED` — the same pair
   * `approvalService.approve()` + `publishService.publish()` together emit
   * for TalentVersion — so this row's audit trail/History tab reads
   * identically ("אושר לפרסום" / "גרסה פורסמה") regardless of which engine
   * produced it.
   *
   * @param {object} adapter - needs getSocialById, approveSocial, entityType
   * @param {object} params
   * @param {string} params.parentId - the Talent id
   * @param {string} params.socialId
   * @param {string} params.actorId
   * @param {string} params.actorRole - must be ROLE.OWNER (defense in depth).
   * @returns {Promise<{ account: object }>}
   */
  async approve(adapter, { parentId, socialId, actorId, actorRole } = {}) {
    if (!parentId) {
      throw new Error('[socialsService.approve] parentId is required.');
    }
    if (!socialId) {
      throw new Error('[socialsService.approve] socialId is required.');
    }
    if (!actorId) {
      throw new Error('[socialsService.approve] actorId is required.');
    }
    assertActorIsOwner(actorRole, 'socialsService.approve');

    const existing = await adapter.getSocialById(socialId);
    if (!existing || existing.talentId !== parentId) {
      const error = new Error(
        `[socialsService.approve] social account "${socialId}" not found for this talent.`
      );
      error.code = 'NOT_FOUND';
      throw error;
    }
    if (existing.versionStatus !== VERSION_STATUS.PROPOSED) {
      const error = new Error(
        `[socialsService.approve] social account "${socialId}" is "${existing.versionStatus}", ` +
          'not PROPOSED — only a PROPOSED proposal can be approved.'
      );
      error.code = 'NOT_PROPOSABLE';
      throw error;
    }

    const account = await adapter.approveSocial(socialId, { approvedById: actorId });

    await eventService.emit(EVENT_TYPE.VERSION_PUBLISHED, {
      entityType: adapter.entityType,
      entityId: parentId,
      actorId,
      payload: { socialId },
      metadata: {},
    });
    await eventService.emit(EVENT_TYPE.PROPOSAL_APPROVED, {
      entityType: adapter.entityType,
      entityId: parentId,
      actorId,
      payload: { socialId },
      metadata: {},
    });

    return { account };
  },

  /**
   * Owner Approve/Reject (Social Links) sprint — reject one PROPOSED
   * TalentSocial row with a required `rejectionNote`, mirroring
   * `approvalService.reject()` but scoped to a single TalentSocial row via
   * `adapter.rejectSocial`. Independent of approve/publish entirely — only
   * flips the row's own status, same as the TalentVersion equivalent.
   *
   * @param {object} adapter - needs getSocialById, rejectSocial, entityType
   * @param {object} params
   * @param {string} params.parentId - the Talent id
   * @param {string} params.socialId
   * @param {string} params.actorId
   * @param {string} params.actorRole - must be ROLE.OWNER (defense in depth).
   * @param {string} params.rejectionNote
   * @returns {Promise<{ account: object }>}
   */
  async reject(adapter, { parentId, socialId, actorId, actorRole, rejectionNote } = {}) {
    if (!parentId) {
      throw new Error('[socialsService.reject] parentId is required.');
    }
    if (!socialId) {
      throw new Error('[socialsService.reject] socialId is required.');
    }
    if (!actorId) {
      throw new Error('[socialsService.reject] actorId is required.');
    }
    assertActorIsOwner(actorRole, 'socialsService.reject');
    if (!rejectionNote || !rejectionNote.trim()) {
      const error = new Error(
        '[socialsService.reject] rejectionNote is required (rejection always requires a note).'
      );
      error.code = 'REJECTION_NOTE_REQUIRED';
      throw error;
    }

    const existing = await adapter.getSocialById(socialId);
    if (!existing || existing.talentId !== parentId) {
      const error = new Error(
        `[socialsService.reject] social account "${socialId}" not found for this talent.`
      );
      error.code = 'NOT_FOUND';
      throw error;
    }
    if (existing.versionStatus !== VERSION_STATUS.PROPOSED) {
      const error = new Error(
        `[socialsService.reject] social account "${socialId}" is "${existing.versionStatus}", ` +
          'not PROPOSED — only a PROPOSED proposal can be rejected.'
      );
      error.code = 'NOT_PROPOSABLE';
      throw error;
    }

    const account = await adapter.rejectSocial(socialId, { rejectionNote });

    await eventService.emit(EVENT_TYPE.PROPOSAL_REJECTED, {
      entityType: adapter.entityType,
      entityId: parentId,
      actorId,
      payload: { socialId, rejectionNote },
      metadata: {},
    });

    return { account };
  },

  /**
   * Rejected Resubmission Recovery sprint — turn a REJECTED TalentSocial row
   * into a fresh, editable DRAFT, so an editor has an actual way to act on
   * an Owner's rejection note instead of the row being permanently stuck
   * (see this sprint's investigation: REJECTED rows are never editable in
   * place anywhere in this codebase — intentional, consistent with
   * proposalService.update()'s DRAFT-or-PROPOSED-only rule — but Social
   * Links had no equivalent of TalentVersion's `/proposals` POST route +
   * StartEditingButton to ever produce a *new* row continuing that
   * lineage).
   *
   * Never updates the REJECTED row itself (`adapter.updateSocialFields` is
   * not called here at all) — a brand-new row is always inserted via
   * `adapter.insertDraftSocial`, mirroring how saveDraft() never edits a
   * PUBLISHED row in place either.
   *
   * Lineage rule, mirroring the `/proposals` route's
   * `basedOnVersionId: publishedVersion.id` pattern:
   *   - If the rejected row's own `basedOnVersionId` still resolves to a
   *     row that is currently PUBLISHED, the new Draft's `basedOnVersionId`
   *     is set to that same published row's id. This is exactly the
   *     linkage `social-review.js`'s `buildSocialReviewItems` matches on,
   *     so the new Draft (once submitted) is classified CHANGED, not ADDED.
   *   - Otherwise (brand-new account with no published base, or the
   *     original base is no longer PUBLISHED) the new Draft's
   *     `basedOnVersionId` is set to the rejected row's own id instead.
   *     `buildSocialReviewItems` only ever matches a `basedOnVersionId`
   *     against the *currently published* rows it's given — a REJECTED
   *     row is never part of that set — so this never causes a false
   *     CHANGED classification. It does give the rejected row a stable,
   *     permanent anchor that every later attempt in the same thread
   *     inherits (a resumed Draft that gets rejected again keeps the same
   *     `basedOnVersionId`, since this method never touches it), which is
   *     exactly the key `social-review.js`'s `filterUnresolvedRejectedSocials`
   *     uses to hide every older rejection in a thread once a newer one
   *     exists.
   *
   * Always seeds the new Draft's business fields from the REJECTED row's
   * own fields (not the live published baseline) — the whole point of
   * "continue fixing" is that the editor doesn't have to retype what they
   * already submitted just because the Owner flagged an issue with it.
   *
   * @param {object} adapter - needs getSocialById, insertDraftSocial, entityType
   * @param {object} params
   * @param {string} params.parentId - the Talent id
   * @param {string} params.socialId - the REJECTED row's id
   * @param {string} params.actorId
   * @returns {Promise<{ account: object }>}
   */
  async resumeRejected(adapter, { parentId, socialId, actorId } = {}) {
    if (!parentId) {
      throw new Error('[socialsService.resumeRejected] parentId is required.');
    }
    if (!socialId) {
      throw new Error('[socialsService.resumeRejected] socialId is required.');
    }
    if (!actorId) {
      throw new Error('[socialsService.resumeRejected] actorId is required.');
    }

    const rejected = await adapter.getSocialById(socialId);
    if (!rejected || rejected.talentId !== parentId) {
      const error = new Error(
        `[socialsService.resumeRejected] social account "${socialId}" not found for this talent.`
      );
      error.code = 'NOT_FOUND';
      throw error;
    }
    if (rejected.versionStatus !== VERSION_STATUS.REJECTED) {
      const error = new Error(
        `[socialsService.resumeRejected] social account "${socialId}" is ` +
          `"${rejected.versionStatus}", not REJECTED — only a rejected account can be resumed.`
      );
      error.code = 'NOT_REJECTED';
      throw error;
    }

    let lineageBasedOnVersionId = rejected.id;
    if (rejected.basedOnVersionId) {
      const basis = await adapter.getSocialById(rejected.basedOnVersionId);
      if (basis && basis.versionStatus === VERSION_STATUS.PUBLISHED) {
        lineageBasedOnVersionId = basis.id;
      }
    }

    const seedFields = {
      platform: rejected.platform,
      label: rejected.label,
      customLabel: rejected.customLabel,
      handle: rejected.handle,
      url: rejected.url,
      sortOrder: rejected.sortOrder,
    };

    const account = await adapter.insertDraftSocial(seedFields, {
      parentId,
      basedOnVersionId: lineageBasedOnVersionId,
      createdById: actorId,
    });

    await eventService.emit(EVENT_TYPE.PROPOSAL_CREATED, {
      entityType: adapter.entityType,
      entityId: parentId,
      actorId,
      payload: { socialId: account.id, fields: seedFields, resumedFromSocialId: socialId },
      metadata: {},
    });

    return { account };
  },
};

export default socialsService;
