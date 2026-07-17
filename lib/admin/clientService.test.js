/*
 * clientService — unit tests (Sprint 7B: Clients & Brands Foundation).
 *
 * clientRepository/brandRepository and eventService are mocked — this file
 * verifies clientService's own rules (role re-assertion for both business
 * roles, OWNER-only archive, Hebrew validation errors, conflict-code
 * translation, archived-record read-only behavior, and the allowlisted
 * event payloads), never the repositories' Prisma mechanics (those have
 * their own tests). All fixtures use synthetic Demo names only, per the
 * sprint's development-data policy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  // clientRepository
  listClients: vi.fn(),
  getClientById: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  archiveClient: vi.fn(),
  // brandRepository
  getBrandById: vi.fn(),
  createBrand: vi.fn(),
  updateBrand: vi.fn(),
  archiveBrand: vi.fn(),
  // eventService
  emit: vi.fn(),
}));

vi.mock('./repository/clientRepository', () => ({
  clientRepository: {
    listClients: hoisted.listClients,
    getById: hoisted.getClientById,
    createClient: hoisted.createClient,
    updateClient: hoisted.updateClient,
    archiveClient: hoisted.archiveClient,
  },
}));

vi.mock('./repository/brandRepository', () => ({
  brandRepository: {
    getById: hoisted.getBrandById,
    createBrand: hoisted.createBrand,
    updateBrand: hoisted.updateBrand,
    archiveBrand: hoisted.archiveBrand,
  },
}));

vi.mock('./engine/eventService', () => ({
  eventService: { emit: hoisted.emit },
}));

import { clientService } from './clientService';
import {
  ROLE,
  ENTITY_TYPE,
  LIFECYCLE_STATUS,
  CLIENT_NAME_CONFLICT_ERROR_CODE,
  BRAND_NAME_CONFLICT_ERROR_CODE,
} from './constants/enums';
import { EVENT_TYPE } from './engine/eventTypes';
import { he } from './i18n/he';

const ERR = he.clients.errors;

const ACTIVE_CLIENT = Object.freeze({
  id: 'client-1',
  name: 'לקוח דמו א׳',
  normalizedName: 'לקוח דמו א׳',
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  notes: null,
  status: LIFECYCLE_STATUS.ACTIVE,
  brands: [],
});

const ARCHIVED_CLIENT = Object.freeze({
  ...ACTIVE_CLIENT,
  id: 'client-2',
  name: 'לקוח דמו ב׳',
  status: LIFECYCLE_STATUS.ARCHIVED,
});

const ACTIVE_BRAND = Object.freeze({
  id: 'brand-1',
  clientId: 'client-1',
  name: 'מותג דמו קיץ',
  normalizedName: 'מותג דמו קיץ',
  notes: null,
  status: LIFECYCLE_STATUS.ACTIVE,
});

function conflictFromRepo(code) {
  return Object.assign(new Error('repo conflict'), { code });
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.emit.mockResolvedValue({ id: 'event-1' });
});

// ─── Authorization re-assertion (defense in depth) ─────────────────────────

describe('role re-assertion', () => {
  it('rejects a missing/unknown role with 403 for every method and never touches a repository', async () => {
    const calls = [
      clientService.listClients({}, { actorRole: undefined }),
      clientService.getClientDetail('client-1', { actorRole: 'INTRUDER' }),
      clientService.createClient({ name: 'לקוח דמו א׳' }, { actorRole: null }),
      clientService.updateClient('client-1', { name: 'x' }, { actorRole: 'READONLY' }),
      clientService.createBrand('client-1', { name: 'מותג דמו קיץ' }, {}),
      clientService.updateBrand('brand-1', { name: 'x' }, {}),
    ];
    for (const promise of calls) {
      await expect(promise).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_ROLE' });
    }
    expect(hoisted.listClients).not.toHaveBeenCalled();
    expect(hoisted.getClientById).not.toHaveBeenCalled();
    expect(hoisted.createClient).not.toHaveBeenCalled();
    expect(hoisted.updateClient).not.toHaveBeenCalled();
    expect(hoisted.createBrand).not.toHaveBeenCalled();
    expect(hoisted.updateBrand).not.toHaveBeenCalled();
  });

  it('allows EMPLOYEE to list, view, create, and edit', async () => {
    hoisted.listClients.mockResolvedValue([ACTIVE_CLIENT]);
    hoisted.getClientById.mockResolvedValue({ ...ACTIVE_CLIENT });
    hoisted.createClient.mockResolvedValue({ ...ACTIVE_CLIENT });

    await expect(clientService.listClients({}, { actorRole: ROLE.EMPLOYEE })).resolves.toEqual([
      ACTIVE_CLIENT,
    ]);
    await expect(
      clientService.getClientDetail('client-1', { actorRole: ROLE.EMPLOYEE })
    ).resolves.toMatchObject({ id: 'client-1' });
    await expect(
      clientService.createClient({ name: 'לקוח דמו א׳' }, { actorRole: ROLE.EMPLOYEE })
    ).resolves.toMatchObject({ id: 'client-1' });
  });

  it('EMPLOYEE cannot archive a client — 403, repository never called', async () => {
    await expect(
      clientService.archiveClient('client-1', { actorRole: ROLE.EMPLOYEE, actorId: 'emp-1' })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_ROLE', message: ERR.archiveOwnerOnly });
    expect(hoisted.getClientById).not.toHaveBeenCalled();
    expect(hoisted.archiveClient).not.toHaveBeenCalled();
  });

  it('EMPLOYEE cannot archive a brand — 403, repository never called', async () => {
    await expect(
      clientService.archiveBrand('brand-1', { actorRole: ROLE.EMPLOYEE, actorId: 'emp-1' })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_ROLE' });
    expect(hoisted.getBrandById).not.toHaveBeenCalled();
    expect(hoisted.archiveBrand).not.toHaveBeenCalled();
  });
});

// ─── createClient ───────────────────────────────────────────────────────────

describe('clientService.createClient', () => {
  it('rejects a missing/whitespace name with the Hebrew required-name field error', async () => {
    for (const badName of [undefined, '', '   ']) {
      await expect(
        clientService.createClient({ name: badName }, { actorRole: ROLE.OWNER })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        fieldErrors: { name: ERR.clientNameRequired },
      });
    }
    expect(hoisted.createClient).not.toHaveBeenCalled();
  });

  it('rejects an invalid contact email with the Hebrew field error', async () => {
    await expect(
      clientService.createClient(
        { name: 'לקוח דמו א׳', contactEmail: 'not-an-email' },
        { actorRole: ROLE.OWNER }
      )
    ).rejects.toMatchObject({ fieldErrors: { contactEmail: ERR.contactEmailInvalid } });
    expect(hoisted.createClient).not.toHaveBeenCalled();
  });

  it('passes trimmed name + normalizedName to the repository and nulls empty optionals', async () => {
    hoisted.createClient.mockResolvedValue({ ...ACTIVE_CLIENT });

    await clientService.createClient(
      { name: '  לקוח  דמו א׳ ', contactName: '  ', notes: '' },
      { actorRole: ROLE.EMPLOYEE, actorId: 'emp-1' }
    );

    expect(hoisted.createClient).toHaveBeenCalledWith({
      name: 'לקוח דמו א׳',
      normalizedName: 'לקוח דמו א׳',
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      notes: null,
    });
  });

  it('translates the repository conflict code into a Hebrew 409 (duplicate after normalization)', async () => {
    hoisted.createClient.mockRejectedValue(conflictFromRepo(CLIENT_NAME_CONFLICT_ERROR_CODE));

    await expect(
      clientService.createClient({ name: 'לקוח דמו א׳' }, { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: CLIENT_NAME_CONFLICT_ERROR_CODE,
      message: ERR.clientNameTaken,
      fieldErrors: { name: ERR.clientNameTaken },
    });
    expect(hoisted.emit).not.toHaveBeenCalled();
  });

  it('emits ClientCreated with an allowlisted payload — never contact details or notes', async () => {
    hoisted.createClient.mockResolvedValue({ ...ACTIVE_CLIENT, contactEmail: 'demo@example.com' });

    await clientService.createClient(
      {
        name: 'לקוח דמו א׳',
        contactEmail: 'demo@example.com',
        contactPhone: '000-0000000',
        notes: 'הערת דמו',
      },
      { actorRole: ROLE.OWNER, actorId: 'owner-1', correlationId: 'corr-1', requestMetadata: { ipAddress: '127.0.0.1' } }
    );

    expect(hoisted.emit).toHaveBeenCalledTimes(1);
    const [type, event] = hoisted.emit.mock.calls[0];
    expect(type).toBe(EVENT_TYPE.CLIENT_CREATED);
    expect(event.entityType).toBe(ENTITY_TYPE.CLIENT);
    expect(event.entityId).toBe('client-1');
    expect(event.actorId).toBe('owner-1');
    expect(event.correlationId).toBe('corr-1');
    expect(event.payload).toEqual({ name: 'לקוח דמו א׳', status: LIFECYCLE_STATUS.ACTIVE });
    expect(JSON.stringify(event.payload)).not.toContain('demo@example.com');
    expect(JSON.stringify(event.payload)).not.toContain('הערת דמו');
  });

  it('still resolves when event emission fails (committed-mutation-wins)', async () => {
    hoisted.createClient.mockResolvedValue({ ...ACTIVE_CLIENT });
    hoisted.emit.mockRejectedValue(new Error('event pipeline down'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      clientService.createClient({ name: 'לקוח דמו א׳' }, { actorRole: ROLE.OWNER })
    ).resolves.toMatchObject({ id: 'client-1' });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

// ─── updateClient ───────────────────────────────────────────────────────────

describe('clientService.updateClient', () => {
  it('404s with the Hebrew message when the client does not exist', async () => {
    hoisted.getClientById.mockResolvedValue(null);
    await expect(
      clientService.updateClient('missing', { name: 'x' }, { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 404, message: ERR.clientNotFound });
  });

  it('rejects edits to an ARCHIVED client with a Hebrew 409 (archived records are read-only)', async () => {
    hoisted.getClientById.mockResolvedValue({ ...ARCHIVED_CLIENT });
    await expect(
      clientService.updateClient('client-2', { name: 'שם חדש' }, { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 409, code: 'CLIENT_ARCHIVED', message: ERR.clientArchived });
    expect(hoisted.updateClient).not.toHaveBeenCalled();
  });

  it('is a no-op (no repo write, no event) when nothing actually changed', async () => {
    hoisted.getClientById.mockResolvedValue({ ...ACTIVE_CLIENT });
    const result = await clientService.updateClient(
      'client-1',
      { name: ACTIVE_CLIENT.name, contactName: '' },
      { actorRole: ROLE.EMPLOYEE }
    );
    expect(result).toMatchObject({ id: 'client-1' });
    expect(hoisted.updateClient).not.toHaveBeenCalled();
    expect(hoisted.emit).not.toHaveBeenCalled();
  });

  it('renames with fresh normalizedName and emits changed field NAMES only', async () => {
    hoisted.getClientById.mockResolvedValue({ ...ACTIVE_CLIENT });
    hoisted.updateClient.mockResolvedValue({ ...ACTIVE_CLIENT, name: 'לקוח דמו ב׳' });

    await clientService.updateClient(
      'client-1',
      { name: 'לקוח דמו ב׳', contactPhone: '000-0000000' },
      { actorRole: ROLE.OWNER, actorId: 'owner-1' }
    );

    expect(hoisted.updateClient).toHaveBeenCalledWith('client-1', {
      name: 'לקוח דמו ב׳',
      normalizedName: 'לקוח דמו ב׳',
      contactPhone: '000-0000000',
    });

    const [type, event] = hoisted.emit.mock.calls[0];
    expect(type).toBe(EVENT_TYPE.CLIENT_UPDATED);
    expect(event.payload).toEqual({
      name: 'לקוח דמו ב׳',
      changedFields: ['name', 'contactPhone'],
    });
    // Changed VALUES of contact fields never enter the payload.
    expect(JSON.stringify(event.payload)).not.toContain('000-0000000');
  });

  it('translates a rename collision into the Hebrew 409', async () => {
    hoisted.getClientById.mockResolvedValue({ ...ACTIVE_CLIENT });
    hoisted.updateClient.mockRejectedValue(conflictFromRepo(CLIENT_NAME_CONFLICT_ERROR_CODE));

    await expect(
      clientService.updateClient('client-1', { name: 'לקוח דמו ב׳' }, { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 409, message: ERR.clientNameTaken });
  });
});

// ─── archiveClient ──────────────────────────────────────────────────────────

describe('clientService.archiveClient', () => {
  it('OWNER archives an active client, repo stamps attribution, ClientArchived emitted', async () => {
    hoisted.getClientById.mockResolvedValue({ ...ACTIVE_CLIENT });
    hoisted.archiveClient.mockResolvedValue({ ...ACTIVE_CLIENT, status: LIFECYCLE_STATUS.ARCHIVED });

    const result = await clientService.archiveClient('client-1', {
      actorRole: ROLE.OWNER,
      actorId: 'owner-1',
      correlationId: 'corr-9',
    });

    expect(result.status).toBe(LIFECYCLE_STATUS.ARCHIVED);
    expect(hoisted.archiveClient).toHaveBeenCalledWith('client-1', 'owner-1');

    const [type, event] = hoisted.emit.mock.calls[0];
    expect(type).toBe(EVENT_TYPE.CLIENT_ARCHIVED);
    expect(event.entityType).toBe(ENTITY_TYPE.CLIENT);
    expect(event.payload).toEqual({ name: 'לקוח דמו א׳', status: LIFECYCLE_STATUS.ARCHIVED });
  });

  it('409s (Hebrew) when the client is already archived — no double archive', async () => {
    hoisted.getClientById.mockResolvedValue({ ...ARCHIVED_CLIENT });
    await expect(
      clientService.archiveClient('client-2', { actorRole: ROLE.OWNER, actorId: 'owner-1' })
    ).rejects.toMatchObject({ statusCode: 409, code: 'CLIENT_ALREADY_ARCHIVED', message: ERR.clientAlreadyArchived });
    expect(hoisted.archiveClient).not.toHaveBeenCalled();
  });
});

// ─── createBrand ────────────────────────────────────────────────────────────

describe('clientService.createBrand', () => {
  it('404s when the parent client does not exist', async () => {
    hoisted.getClientById.mockResolvedValue(null);
    await expect(
      clientService.createBrand('missing', { name: 'מותג דמו קיץ' }, { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 404, message: ERR.clientNotFound });
    expect(hoisted.createBrand).not.toHaveBeenCalled();
  });

  it('rejects adding a brand to an ARCHIVED client', async () => {
    hoisted.getClientById.mockResolvedValue({ ...ARCHIVED_CLIENT });
    await expect(
      clientService.createBrand('client-2', { name: 'מותג דמו קיץ' }, { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 409, code: 'CLIENT_ARCHIVED' });
    expect(hoisted.createBrand).not.toHaveBeenCalled();
  });

  it('rejects a missing brand name with the Hebrew field error', async () => {
    hoisted.getClientById.mockResolvedValue({ ...ACTIVE_CLIENT });
    await expect(
      clientService.createBrand('client-1', { name: ' ' }, { actorRole: ROLE.EMPLOYEE })
    ).rejects.toMatchObject({ fieldErrors: { name: ERR.brandNameRequired } });
  });

  it('translates a within-client duplicate into the Hebrew 409', async () => {
    hoisted.getClientById.mockResolvedValue({ ...ACTIVE_CLIENT });
    hoisted.createBrand.mockRejectedValue(conflictFromRepo(BRAND_NAME_CONFLICT_ERROR_CODE));

    await expect(
      clientService.createBrand('client-1', { name: 'מותג דמו קיץ' }, { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: BRAND_NAME_CONFLICT_ERROR_CODE,
      message: ERR.brandNameTaken,
    });
  });

  it('EMPLOYEE creates a brand; BrandCreated emitted with allowlisted payload', async () => {
    hoisted.getClientById.mockResolvedValue({ ...ACTIVE_CLIENT });
    hoisted.createBrand.mockResolvedValue({ ...ACTIVE_BRAND });

    await clientService.createBrand(
      'client-1',
      { name: '  מותג  דמו קיץ ', notes: 'הערת דמו למותג' },
      { actorRole: ROLE.EMPLOYEE, actorId: 'emp-1' }
    );

    expect(hoisted.createBrand).toHaveBeenCalledWith({
      clientId: 'client-1',
      name: 'מותג דמו קיץ',
      normalizedName: 'מותג דמו קיץ',
      notes: 'הערת דמו למותג',
    });

    const [type, event] = hoisted.emit.mock.calls[0];
    expect(type).toBe(EVENT_TYPE.BRAND_CREATED);
    expect(event.entityType).toBe(ENTITY_TYPE.BRAND);
    expect(event.entityId).toBe('brand-1');
    expect(event.payload).toEqual({
      name: 'מותג דמו קיץ',
      clientId: 'client-1',
      status: LIFECYCLE_STATUS.ACTIVE,
    });
    // Notes never enter the payload.
    expect(JSON.stringify(event.payload)).not.toContain('הערת דמו למותג');
  });
});

// ─── updateBrand / archiveBrand ─────────────────────────────────────────────

describe('clientService.updateBrand', () => {
  it('404s when the brand does not exist', async () => {
    hoisted.getBrandById.mockResolvedValue(null);
    await expect(
      clientService.updateBrand('missing', { name: 'x' }, { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 404, message: ERR.brandNotFound });
  });

  it('rejects edits to an ARCHIVED brand with a Hebrew 409', async () => {
    hoisted.getBrandById.mockResolvedValue({ ...ACTIVE_BRAND, status: LIFECYCLE_STATUS.ARCHIVED });
    await expect(
      clientService.updateBrand('brand-1', { name: 'שם חדש' }, { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 409, code: 'BRAND_ARCHIVED', message: ERR.brandArchived });
    expect(hoisted.updateBrand).not.toHaveBeenCalled();
  });

  it('renames within the brand\'s existing client and emits changed field names', async () => {
    hoisted.getBrandById.mockResolvedValue({ ...ACTIVE_BRAND });
    hoisted.updateBrand.mockResolvedValue({ ...ACTIVE_BRAND, name: 'מותג דמו בית' });

    await clientService.updateBrand(
      'brand-1',
      { name: 'מותג דמו בית' },
      { actorRole: ROLE.EMPLOYEE, actorId: 'emp-1' }
    );

    expect(hoisted.updateBrand).toHaveBeenCalledWith('brand-1', 'client-1', {
      name: 'מותג דמו בית',
      normalizedName: 'מותג דמו בית',
    });

    const [type, event] = hoisted.emit.mock.calls[0];
    expect(type).toBe(EVENT_TYPE.BRAND_UPDATED);
    expect(event.payload).toEqual({
      name: 'מותג דמו בית',
      clientId: 'client-1',
      changedFields: ['name'],
    });
  });

  it('translates a rename collision inside the same client into the Hebrew 409', async () => {
    hoisted.getBrandById.mockResolvedValue({ ...ACTIVE_BRAND });
    hoisted.updateBrand.mockRejectedValue(conflictFromRepo(BRAND_NAME_CONFLICT_ERROR_CODE));

    await expect(
      clientService.updateBrand('brand-1', { name: 'מותג דמו בית' }, { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 409, message: ERR.brandNameTaken });
  });
});

describe('clientService.archiveBrand', () => {
  it('OWNER archives an active brand and BrandArchived is emitted', async () => {
    hoisted.getBrandById.mockResolvedValue({ ...ACTIVE_BRAND });
    hoisted.archiveBrand.mockResolvedValue({ ...ACTIVE_BRAND, status: LIFECYCLE_STATUS.ARCHIVED });

    const result = await clientService.archiveBrand('brand-1', {
      actorRole: ROLE.OWNER,
      actorId: 'owner-1',
    });

    expect(result.status).toBe(LIFECYCLE_STATUS.ARCHIVED);
    expect(hoisted.archiveBrand).toHaveBeenCalledWith('brand-1', 'owner-1');

    const [type, event] = hoisted.emit.mock.calls[0];
    expect(type).toBe(EVENT_TYPE.BRAND_ARCHIVED);
    expect(event.payload).toEqual({
      name: 'מותג דמו קיץ',
      clientId: 'client-1',
      status: LIFECYCLE_STATUS.ARCHIVED,
    });
  });

  it('409s when the brand is already archived', async () => {
    hoisted.getBrandById.mockResolvedValue({ ...ACTIVE_BRAND, status: LIFECYCLE_STATUS.ARCHIVED });
    await expect(
      clientService.archiveBrand('brand-1', { actorRole: ROLE.OWNER, actorId: 'owner-1' })
    ).rejects.toMatchObject({ statusCode: 409, code: 'BRAND_ALREADY_ARCHIVED' });
    expect(hoisted.archiveBrand).not.toHaveBeenCalled();
  });
});
