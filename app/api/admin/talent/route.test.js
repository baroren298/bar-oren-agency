/*
 * POST /api/admin/talent — route-level coverage (Sprint 5B: Create Talent
 * test completion).
 *
 * Complements lib/admin/repository/talentRepository.
 * createTalentWithInitialVersion.test.js, which proves the atomic
 * parent+DRAFT-version write at the repository layer. This file covers only
 * what exists at the HTTP/route layer: the requireOwnerOrEmployee auth gate
 * (401/403), that both OWNER and EMPLOYEE are let through, request-body
 * validation (name/slug required, slug format), the advisory duplicate-slug
 * read (409), the authoritative P2002 race translation (409), the success
 * contract (201 + talent/version passthrough), the PROPOSAL_CREATED audit
 * event emission, and that unexpected repository errors normalize to a
 * generic Hebrew 500 without leaking internals.
 *
 * `requireOwnerOrEmployee`, `talentAdapter`, and `eventService` are mocked,
 * same pattern as app/api/admin/talent/[id]/proposals/[versionId]/discard/
 * route.test.js — this file verifies the route wires them together
 * correctly, not the business logic itself.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  requireOwnerOrEmployee: vi.fn(),
  getParentBySlug: vi.fn(),
  validate: vi.fn(),
  createParentWithInitialVersion: vi.fn(),
  emit: vi.fn(),
}));

vi.mock('@/lib/admin/auth/authorize', () => ({
  requireOwnerOrEmployee: hoisted.requireOwnerOrEmployee,
}));

vi.mock('@/lib/admin/engine/adapters/talentAdapter', () => ({
  talentAdapter: {
    entityType: 'TALENT',
    getParentBySlug: hoisted.getParentBySlug,
    validate: hoisted.validate,
    createParentWithInitialVersion: hoisted.createParentWithInitialVersion,
  },
}));

vi.mock('@/lib/admin/engine/eventService', () => ({
  eventService: { emit: hoisted.emit },
}));

import { POST } from './route';
import { ROLE, VERSION_STATUS } from '@/lib/admin/constants/enums';
import { EVENT_TYPE } from '@/lib/admin/engine/eventTypes';
import { he } from '@/lib/admin/i18n/he';

const ERRORS = he.talent.create.errors;

// The route only reads request.json() (auth is mocked), so a stub with a
// json() method is a sufficient stand-in for a NextRequest.
function makeRequest(body) {
  return {
    json: async () => {
      if (body === undefined) throw new SyntaxError('Unexpected end of JSON input');
      return body;
    },
  };
}

const VALID_BODY = Object.freeze({
  name: 'ישראל ישראלי',
  nameEn: 'Israel Israeli',
  slug: 'israel-israeli',
  bioHe: 'ביוגרפיה קצרה',
  profileImageAssetId: 'asset-1',
});

const CREATED = Object.freeze({
  talent: Object.freeze({
    id: 'talent-new',
    slug: 'israel-israeli',
    status: 'ACTIVE',
    revisionNumber: 1,
    currentPublishedVersionId: null,
  }),
  version: Object.freeze({
    id: 'version-new',
    talentId: 'talent-new',
    status: VERSION_STATUS.DRAFT,
    name: 'ישראל ישראלי',
  }),
});

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.requireOwnerOrEmployee.mockResolvedValue({ userId: 'owner-1', role: ROLE.OWNER });
  hoisted.getParentBySlug.mockResolvedValue(null); // slug free by default
  hoisted.validate.mockReturnValue({ valid: true });
  hoisted.createParentWithInitialVersion.mockResolvedValue({
    talent: { ...CREATED.talent },
    version: { ...CREATED.version },
  });
  hoisted.emit.mockResolvedValue(undefined);
});

describe('POST /api/admin/talent — auth gate', () => {
  it('returns 401 when there is no valid session, without creating anything', async () => {
    hoisted.requireOwnerOrEmployee.mockRejectedValue(
      Object.assign(new Error('Not authenticated'), { statusCode: 401 })
    );

    const response = await POST(makeRequest({ ...VALID_BODY }));

    expect(response.status).toBe(401);
    expect(hoisted.createParentWithInitialVersion).not.toHaveBeenCalled();
    expect(hoisted.emit).not.toHaveBeenCalled();
  });

  it('returns 403 when the session role is not an allowed role, without creating anything', async () => {
    // requireOwnerOrEmployee itself rejects any role outside
    // [OWNER, EMPLOYEE] with a 403 — the route must surface that status.
    hoisted.requireOwnerOrEmployee.mockRejectedValue(
      Object.assign(new Error('Forbidden'), { statusCode: 403 })
    );

    const response = await POST(makeRequest({ ...VALID_BODY }));

    expect(response.status).toBe(403);
    expect(hoisted.createParentWithInitialVersion).not.toHaveBeenCalled();
    expect(hoisted.emit).not.toHaveBeenCalled();
  });

  it('OWNER can create a talent (201, actor forwarded as createdById)', async () => {
    hoisted.requireOwnerOrEmployee.mockResolvedValue({ userId: 'owner-1', role: ROLE.OWNER });

    const response = await POST(makeRequest({ ...VALID_BODY }));

    expect(response.status).toBe(201);
    expect(hoisted.createParentWithInitialVersion).toHaveBeenCalledWith(expect.any(Object), {
      slug: 'israel-israeli',
      createdById: 'owner-1',
    });
  });

  it('EMPLOYEE can create a talent (201, actor forwarded as createdById)', async () => {
    hoisted.requireOwnerOrEmployee.mockResolvedValue({
      userId: 'employee-1',
      role: ROLE.EMPLOYEE,
    });

    const response = await POST(makeRequest({ ...VALID_BODY }));

    expect(response.status).toBe(201);
    expect(hoisted.createParentWithInitialVersion).toHaveBeenCalledWith(expect.any(Object), {
      slug: 'israel-israeli',
      createdById: 'employee-1',
    });
  });
});

describe('POST /api/admin/talent — request validation', () => {
  it('returns 400 for an unparseable JSON body', async () => {
    const response = await POST(makeRequest(undefined));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe(ERRORS.invalidBody);
    expect(hoisted.createParentWithInitialVersion).not.toHaveBeenCalled();
  });

  it('returns 400 with a name field error when the Hebrew name is missing', async () => {
    const response = await POST(makeRequest({ ...VALID_BODY, name: '   ' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.name).toBe(ERRORS.nameRequired);
    expect(hoisted.createParentWithInitialVersion).not.toHaveBeenCalled();
  });

  it('returns 400 with a slug field error when the slug is missing', async () => {
    const response = await POST(makeRequest({ ...VALID_BODY, slug: '' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.slug).toBe(ERRORS.slugRequired);
    expect(hoisted.createParentWithInitialVersion).not.toHaveBeenCalled();
  });

  it.each(['רק-עברית', 'has space', 'double--hyphen', '-leading', 'trailing-'])(
    'returns 400 with a slug field error for invalid slug shape %j',
    async (slug) => {
      const response = await POST(makeRequest({ ...VALID_BODY, slug }));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.fieldErrors.slug).toBe(ERRORS.slugInvalid);
      expect(hoisted.createParentWithInitialVersion).not.toHaveBeenCalled();
    }
  );

  it('returns 400 when the shared adapter validation rejects the fields', async () => {
    hoisted.validate.mockReturnValue({ valid: false, errors: { name: 'required' } });

    const response = await POST(makeRequest({ ...VALID_BODY }));

    expect(response.status).toBe(400);
    expect(hoisted.createParentWithInitialVersion).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/talent — duplicate slug', () => {
  it('returns 409 with a slug field error when another talent already owns the slug', async () => {
    hoisted.getParentBySlug.mockResolvedValue({ id: 'talent-existing', slug: 'israel-israeli' });

    const response = await POST(makeRequest({ ...VALID_BODY }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.fieldErrors.slug).toBe(ERRORS.slugTaken);
    expect(hoisted.createParentWithInitialVersion).not.toHaveBeenCalled();
    expect(hoisted.emit).not.toHaveBeenCalled();
  });

  it('returns 409 when the write itself hits the unique constraint (simulated P2002 race)', async () => {
    // The advisory read said "free", but a concurrent create won the race —
    // the repository surfaces Prisma's P2002 and the route translates it.
    hoisted.getParentBySlug.mockResolvedValue(null);
    hoisted.createParentWithInitialVersion.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed on Talent.slug'), { code: 'P2002' })
    );

    const response = await POST(makeRequest({ ...VALID_BODY }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.fieldErrors.slug).toBe(ERRORS.slugTaken);
    expect(hoisted.emit).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/talent — success contract', () => {
  it('returns 201 with the created talent and its initial DRAFT version, no published pointer', async () => {
    const response = await POST(makeRequest({ ...VALID_BODY }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.talent).toEqual(CREATED.talent);
    expect(body.version).toEqual(CREATED.version);
    expect(body.version.status).toBe(VERSION_STATUS.DRAFT);
    expect(body.talent.currentPublishedVersionId).toBeNull();
  });

  it('normalizes input before creating: trims, lowercases the slug, blanks become null', async () => {
    const response = await POST(
      makeRequest({
        name: '  ישראל ישראלי  ',
        nameEn: '   ',
        slug: '  Israel-Israeli ',
        bioHe: '',
        profileImageAssetId: '  ',
      })
    );

    expect(response.status).toBe(201);
    expect(hoisted.createParentWithInitialVersion).toHaveBeenCalledWith(
      {
        name: 'ישראל ישראלי',
        nameEn: null,
        bioHe: null,
        profileImageAssetId: null,
      },
      { slug: 'israel-israeli', createdById: 'owner-1' }
    );
  });

  it('emits the existing PROPOSAL_CREATED audit event with DRAFT metadata and the actor', async () => {
    await POST(makeRequest({ ...VALID_BODY }));

    expect(hoisted.emit).toHaveBeenCalledTimes(1);
    expect(hoisted.emit).toHaveBeenCalledWith(EVENT_TYPE.PROPOSAL_CREATED, {
      entityType: 'TALENT',
      entityId: 'talent-new',
      actorId: 'owner-1',
      payload: {
        versionId: 'version-new',
        fields: expect.objectContaining({ name: VALID_BODY.name, slug: VALID_BODY.slug }),
      },
      metadata: { initialStatus: 'DRAFT' },
    });
  });
});

describe('POST /api/admin/talent — unexpected failures', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('normalizes an unexpected repository error to a generic Hebrew 500 without leaking internals', async () => {
    hoisted.createParentWithInitialVersion.mockRejectedValue(
      new Error('connect ECONNREFUSED db.internal:5432')
    );

    const response = await POST(makeRequest({ ...VALID_BODY }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: ERRORS.serverError });
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
    expect(hoisted.emit).not.toHaveBeenCalled();
  });
});
