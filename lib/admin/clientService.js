/*
 * clientService — Sprint 7B (Clients & Brands Foundation).
 *
 * Business-rule layer between the Clients admin API routes
 * (app/api/admin/clients/*) and clientRepository/brandRepository.
 * Deliberately NOT under lib/admin/engine/ — Clients and Brands are
 * internal operational records with no Draft → Proposed → Published
 * lifecycle, exactly like user accounts (see lib/admin/userService.js's
 * header for the full rationale; this file follows its structure 1:1).
 *
 * Rules that live here (and nowhere else):
 *   - actor-role re-assertion (defense in depth: route-level
 *     requireOwnerOrEmployee/requireOwner is the first gate, this is the
 *     second, independent one). View/create/edit: OWNER or EMPLOYEE.
 *     Archive: OWNER only — enforced server-side; UI visibility is not a
 *     security boundary.
 *   - field validation with FRIENDLY HEBREW messages (he.clients.errors —
 *     shared with the UI so API and client speak identical copy).
 *   - name normalization (lib/admin/normalize-name.js) and translation of
 *     the repositories' coded conflict errors into Hebrew 409s. The
 *     authoritative uniqueness check is transactional inside the
 *     repository; the DB unique index is the race backstop — both surface
 *     here as the same friendly error.
 *   - archive-only lifecycle: no hard delete, no unarchive, archived rows
 *     are read-only (edits and brand-additions rejected) and their names
 *     stay reserved.
 *   - event emission AFTER the committed mutation, with ALLOWLISTED
 *     payloads only: entity name, status, clientId (brands), and changed
 *     field NAMES — never contact email/phone/notes values, so no
 *     unnecessary personal data reaches Event/AuditLog. Same
 *     committed-mutation-wins error handling as userService's
 *     emitUserEvent (see that comment for why an emit failure must not
 *     fail the route).
 */

import { clientRepository } from './repository/clientRepository';
import { brandRepository } from './repository/brandRepository';
import {
  ROLE,
  ENTITY_TYPE,
  LIFECYCLE_STATUS,
  CLIENT_NAME_CONFLICT_ERROR_CODE,
  BRAND_NAME_CONFLICT_ERROR_CODE,
} from './constants/enums';
import { normalizeName } from './normalize-name';
import { eventService } from './engine/eventService';
import { EVENT_TYPE } from './engine/eventTypes';
import { he } from './i18n/he';

const ERR = he.clients.errors;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Both business roles may view/create/edit Clients and Brands. */
function assertActorMayManage(actorRole, action) {
  if (actorRole !== ROLE.OWNER && actorRole !== ROLE.EMPLOYEE) {
    const err = new Error(ERR.forbidden);
    err.statusCode = 403;
    err.code = 'FORBIDDEN_ROLE';
    err.internalAction = action;
    throw err;
  }
}

/** Archive is OWNER-only — re-asserted here independently of the route gate. */
function assertActorIsOwner(actorRole, action) {
  if (actorRole !== ROLE.OWNER) {
    const err = new Error(ERR.archiveOwnerOnly);
    err.statusCode = 403;
    err.code = 'FORBIDDEN_ROLE';
    err.internalAction = action;
    throw err;
  }
}

function validationError(message, fieldErrors) {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = 'VALIDATION_ERROR';
  err.fieldErrors = fieldErrors || {};
  return err;
}

function conflictError(message, code, fieldErrors) {
  const err = new Error(message);
  err.statusCode = 409;
  err.code = code;
  if (fieldErrors) err.fieldErrors = fieldErrors;
  return err;
}

function notFoundError(message) {
  const err = new Error(message);
  err.statusCode = 404;
  err.code = 'NOT_FOUND';
  return err;
}

/** Trim a free-text optional field; '' → null. Never validates content — callers do. */
function optionalText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Validate a required display name and produce its normalized form.
 * Throws the given Hebrew message as a field error when missing/empty
 * (normalization returning '' — e.g. whitespace-only — counts as empty).
 */
function requireName(rawName, requiredMessage) {
  const name = typeof rawName === 'string' ? rawName.trim().replace(/\s+/g, ' ') : '';
  const normalizedName = normalizeName(rawName);
  if (!name || !normalizedName) {
    throw validationError(ERR.validationSummary, { name: requiredMessage });
  }
  return { name, normalizedName };
}

/**
 * Emit one client/brand event AFTER its mutation committed — allowlisted
 * payload only, committed-mutation-wins on emit failure (logged as an
 * audit gap, never rethrown; see header + userService.emitUserEvent).
 */
async function emitClientBrandEvent(type, { entityType, entityId, actorId, correlationId, payload, metadata }) {
  try {
    await eventService.emit(type, {
      entityType,
      entityId,
      actorId: actorId || null,
      correlationId,
      payload: payload || {},
      metadata: metadata || {},
    });
  } catch (err) {
    console.error(
      `[clientService] AUDIT GAP — mutation committed but event "${type}" failed to persist ` +
        `(entity=${entityType}:${entityId}, actor=${actorId || 'unknown'}, correlationId=${correlationId || 'n/a'}):`,
      err
    );
  }
}

export const clientService = {
  /**
   * OWNER/EMPLOYEE. List clients (ACTIVE only by default;
   * includeArchived=true adds archived rows), each with its active-brand
   * count (`_count.brands`).
   */
  async listClients({ includeArchived = false } = {}, { actorRole } = {}) {
    assertActorMayManage(actorRole, 'clientService.listClients');
    return clientRepository.listClients({ includeArchived: Boolean(includeArchived) });
  },

  /** OWNER/EMPLOYEE. One client with all its brands. 404 when absent. */
  async getClientDetail(clientId, { actorRole } = {}) {
    assertActorMayManage(actorRole, 'clientService.getClientDetail');
    if (!clientId) throw validationError(ERR.invalidBody, {});
    const client = await clientRepository.getById(clientId);
    if (!client) throw notFoundError(ERR.clientNotFound);
    return client;
  },

  /**
   * OWNER/EMPLOYEE. Create a client. Name is required and must be unique
   * after normalization — including against archived clients (confirmed
   * product rule: archived names stay reserved).
   */
  async createClient(
    { name, contactName, contactEmail, contactPhone, notes } = {},
    { actorId, actorRole, correlationId, requestMetadata } = {}
  ) {
    assertActorMayManage(actorRole, 'clientService.createClient');

    const validName = requireName(name, ERR.clientNameRequired);

    const cleanContactEmail = optionalText(contactEmail);
    if (cleanContactEmail && !EMAIL_REGEX.test(cleanContactEmail)) {
      throw validationError(ERR.validationSummary, { contactEmail: ERR.contactEmailInvalid });
    }

    let created;
    try {
      created = await clientRepository.createClient({
        name: validName.name,
        normalizedName: validName.normalizedName,
        contactName: optionalText(contactName),
        contactEmail: cleanContactEmail,
        contactPhone: optionalText(contactPhone),
        notes: optionalText(notes),
      });
    } catch (err) {
      if (err.code === CLIENT_NAME_CONFLICT_ERROR_CODE) {
        throw conflictError(ERR.clientNameTaken, CLIENT_NAME_CONFLICT_ERROR_CODE, {
          name: ERR.clientNameTaken,
        });
      }
      throw err;
    }

    // Allowlisted payload: business identity + status only — never contact
    // details or notes.
    await emitClientBrandEvent(EVENT_TYPE.CLIENT_CREATED, {
      entityType: ENTITY_TYPE.CLIENT,
      entityId: created.id,
      actorId,
      correlationId,
      payload: { name: created.name, status: created.status },
      metadata: requestMetadata,
    });

    return created;
  },

  /**
   * OWNER/EMPLOYEE. Update a client's editable fields. Partial: only keys
   * present in `fields` are touched. Archived clients are read-only.
   */
  async updateClient(
    clientId,
    fields = {},
    { actorId, actorRole, correlationId, requestMetadata } = {}
  ) {
    assertActorMayManage(actorRole, 'clientService.updateClient');
    if (!clientId) throw validationError(ERR.invalidBody, {});

    const target = await clientRepository.getById(clientId);
    if (!target) throw notFoundError(ERR.clientNotFound);
    if (target.status === LIFECYCLE_STATUS.ARCHIVED) {
      throw conflictError(ERR.clientArchived, 'CLIENT_ARCHIVED');
    }

    // Explicitly constructed update object — never a request-body spread.
    const data = {};
    const changedFields = [];

    if ('name' in fields) {
      const validName = requireName(fields.name, ERR.clientNameRequired);
      if (validName.name !== target.name) {
        data.name = validName.name;
        data.normalizedName = validName.normalizedName;
        changedFields.push('name');
      }
    }

    for (const key of ['contactName', 'contactEmail', 'contactPhone', 'notes']) {
      if (key in fields) {
        const clean = optionalText(fields[key]);
        if (key === 'contactEmail' && clean && !EMAIL_REGEX.test(clean)) {
          throw validationError(ERR.validationSummary, { contactEmail: ERR.contactEmailInvalid });
        }
        if (clean !== (target[key] ?? null)) {
          data[key] = clean;
          changedFields.push(key);
        }
      }
    }

    if (changedFields.length === 0) return target;

    let updated;
    try {
      updated = await clientRepository.updateClient(clientId, data);
    } catch (err) {
      if (err.code === CLIENT_NAME_CONFLICT_ERROR_CODE) {
        throw conflictError(ERR.clientNameTaken, CLIENT_NAME_CONFLICT_ERROR_CODE, {
          name: ERR.clientNameTaken,
        });
      }
      throw err;
    }

    // Allowlisted payload: changed field NAMES only (values could carry
    // personal contact data) + the resulting display name for narrative.
    await emitClientBrandEvent(EVENT_TYPE.CLIENT_UPDATED, {
      entityType: ENTITY_TYPE.CLIENT,
      entityId: clientId,
      actorId,
      correlationId,
      payload: { name: updated.name, changedFields },
      metadata: requestMetadata,
    });

    return updated;
  },

  /**
   * OWNER ONLY. Archive a client (status → ARCHIVED + attribution stamp).
   * No hard delete, no unarchive. Idempotence guard: archiving an
   * already-archived client is a 409, not a silent success.
   */
  async archiveClient(clientId, { actorId, actorRole, correlationId, requestMetadata } = {}) {
    assertActorIsOwner(actorRole, 'clientService.archiveClient');
    if (!clientId) throw validationError(ERR.invalidBody, {});

    const target = await clientRepository.getById(clientId);
    if (!target) throw notFoundError(ERR.clientNotFound);
    if (target.status === LIFECYCLE_STATUS.ARCHIVED) {
      throw conflictError(ERR.clientAlreadyArchived, 'CLIENT_ALREADY_ARCHIVED');
    }

    const archived = await clientRepository.archiveClient(clientId, actorId);

    await emitClientBrandEvent(EVENT_TYPE.CLIENT_ARCHIVED, {
      entityType: ENTITY_TYPE.CLIENT,
      entityId: clientId,
      actorId,
      correlationId,
      payload: { name: archived.name, status: archived.status },
      metadata: requestMetadata,
    });

    return archived;
  },

  /**
   * OWNER/EMPLOYEE. Create a brand under a client. The parent client must
   * exist and be ACTIVE (no additions to archived clients). Brand name
   * must be unique within the client after normalization — archived
   * brands included; the same name under a DIFFERENT client is fine.
   */
  async createBrand(
    clientId,
    { name, notes } = {},
    { actorId, actorRole, correlationId, requestMetadata } = {}
  ) {
    assertActorMayManage(actorRole, 'clientService.createBrand');
    if (!clientId) throw validationError(ERR.invalidBody, {});

    const client = await clientRepository.getById(clientId);
    if (!client) throw notFoundError(ERR.clientNotFound);
    if (client.status === LIFECYCLE_STATUS.ARCHIVED) {
      throw conflictError(ERR.clientArchived, 'CLIENT_ARCHIVED');
    }

    const validName = requireName(name, ERR.brandNameRequired);

    let created;
    try {
      created = await brandRepository.createBrand({
        clientId,
        name: validName.name,
        normalizedName: validName.normalizedName,
        notes: optionalText(notes),
      });
    } catch (err) {
      if (err.code === BRAND_NAME_CONFLICT_ERROR_CODE) {
        throw conflictError(ERR.brandNameTaken, BRAND_NAME_CONFLICT_ERROR_CODE, {
          name: ERR.brandNameTaken,
        });
      }
      throw err;
    }

    await emitClientBrandEvent(EVENT_TYPE.BRAND_CREATED, {
      entityType: ENTITY_TYPE.BRAND,
      entityId: created.id,
      actorId,
      correlationId,
      payload: { name: created.name, clientId, status: created.status },
      metadata: requestMetadata,
    });

    return created;
  },

  /**
   * OWNER/EMPLOYEE. Rename/edit a brand (name/notes only — no
   * move-between-clients in Sprint 7B). Archived brands are read-only.
   */
  async updateBrand(
    brandId,
    fields = {},
    { actorId, actorRole, correlationId, requestMetadata } = {}
  ) {
    assertActorMayManage(actorRole, 'clientService.updateBrand');
    if (!brandId) throw validationError(ERR.invalidBody, {});

    const target = await brandRepository.getById(brandId);
    if (!target) throw notFoundError(ERR.brandNotFound);
    if (target.status === LIFECYCLE_STATUS.ARCHIVED) {
      throw conflictError(ERR.brandArchived, 'BRAND_ARCHIVED');
    }

    const data = {};
    const changedFields = [];

    if ('name' in fields) {
      const validName = requireName(fields.name, ERR.brandNameRequired);
      if (validName.name !== target.name) {
        data.name = validName.name;
        data.normalizedName = validName.normalizedName;
        changedFields.push('name');
      }
    }

    if ('notes' in fields) {
      const clean = optionalText(fields.notes);
      if (clean !== (target.notes ?? null)) {
        data.notes = clean;
        changedFields.push('notes');
      }
    }

    if (changedFields.length === 0) return target;

    let updated;
    try {
      updated = await brandRepository.updateBrand(brandId, target.clientId, data);
    } catch (err) {
      if (err.code === BRAND_NAME_CONFLICT_ERROR_CODE) {
        throw conflictError(ERR.brandNameTaken, BRAND_NAME_CONFLICT_ERROR_CODE, {
          name: ERR.brandNameTaken,
        });
      }
      throw err;
    }

    await emitClientBrandEvent(EVENT_TYPE.BRAND_UPDATED, {
      entityType: ENTITY_TYPE.BRAND,
      entityId: brandId,
      actorId,
      correlationId,
      payload: { name: updated.name, clientId: target.clientId, changedFields },
      metadata: requestMetadata,
    });

    return updated;
  },

  /** OWNER ONLY. Archive a brand — same rules as archiveClient. */
  async archiveBrand(brandId, { actorId, actorRole, correlationId, requestMetadata } = {}) {
    assertActorIsOwner(actorRole, 'clientService.archiveBrand');
    if (!brandId) throw validationError(ERR.invalidBody, {});

    const target = await brandRepository.getById(brandId);
    if (!target) throw notFoundError(ERR.brandNotFound);
    if (target.status === LIFECYCLE_STATUS.ARCHIVED) {
      throw conflictError(ERR.brandAlreadyArchived, 'BRAND_ALREADY_ARCHIVED');
    }

    const archived = await brandRepository.archiveBrand(brandId, actorId);

    await emitClientBrandEvent(EVENT_TYPE.BRAND_ARCHIVED, {
      entityType: ENTITY_TYPE.BRAND,
      entityId: brandId,
      actorId,
      correlationId,
      payload: { name: archived.name, clientId: target.clientId, status: archived.status },
      metadata: requestMetadata,
    });

    return archived;
  },
};

export default clientService;
