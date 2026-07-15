/*
 * userService — unit tests (Sprint 3: Users UI).
 *
 * userRepository and hashPassword are both mocked — this file's job is to
 * verify userService's own rules (OWNER-only enforcement, field validation,
 * self-disable / last-active-owner protection), not to re-prove
 * userRepository's Prisma calls or bcrypt itself.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  listUsers: vi.fn(),
  getByEmail: vi.fn(),
  getById: vi.fn(),
  getSafeById: vi.fn(),
  createEmployee: vi.fn(),
  updateDisplayName: vi.fn(),
  updateEmail: vi.fn(),
  setActive: vi.fn(),
  setActiveAndRevokeSessions: vi.fn(),
  updatePasswordHash: vi.fn(),
  updatePasswordHashAndRevokeSessions: vi.fn(),
  countActiveOwners: vi.fn(),
  hashPassword: vi.fn(),
  emit: vi.fn(),
}));

vi.mock('./repository/userRepository', () => ({
  userRepository: {
    listUsers: hoisted.listUsers,
    getByEmail: hoisted.getByEmail,
    getById: hoisted.getById,
    getSafeById: hoisted.getSafeById,
    createEmployee: hoisted.createEmployee,
    updateDisplayName: hoisted.updateDisplayName,
    updateEmail: hoisted.updateEmail,
    setActive: hoisted.setActive,
    setActiveAndRevokeSessions: hoisted.setActiveAndRevokeSessions,
    updatePasswordHash: hoisted.updatePasswordHash,
    updatePasswordHashAndRevokeSessions: hoisted.updatePasswordHashAndRevokeSessions,
    countActiveOwners: hoisted.countActiveOwners,
  },
}));

vi.mock('./auth/password', () => ({
  hashPassword: hoisted.hashPassword,
}));

// Sprint 2b — eventService is mocked so these tests verify userService's
// emission rules (what is emitted, when, and what NEVER enters a payload)
// without touching the real Event pipeline (that pipeline has its own
// coverage in lib/admin/engine/__tests__).
vi.mock('./engine/eventService', () => ({
  eventService: { emit: hoisted.emit },
}));

import { userService } from './userService';
import { ROLE, ENTITY_TYPE } from './constants/enums';
import { EVENT_TYPE } from './engine/eventTypes';

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.hashPassword.mockResolvedValue('hashed-password');
  hoisted.emit.mockResolvedValue({ id: 'event-1' });
});

describe('userService.listUsers', () => {
  it('throws a 403-shaped error for a non-OWNER actor and never calls the repository', async () => {
    await expect(userService.listUsers({ actorRole: ROLE.EMPLOYEE })).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN_ROLE',
    });
    expect(hoisted.listUsers).not.toHaveBeenCalled();
  });

  it('returns userRepository.listUsers() for an OWNER actor', async () => {
    hoisted.listUsers.mockResolvedValue([{ id: 'user-1' }]);
    const result = await userService.listUsers({ actorRole: ROLE.OWNER });
    expect(result).toEqual([{ id: 'user-1' }]);
  });
});

describe('userService.createEmployee', () => {
  const validInput = {
    email: 'New.Employee@Example.com',
    displayName: '  Noa Cohen  ',
    temporaryPassword: 'temp12345',
  };

  it('throws 403 for a non-OWNER actor and never touches the repository', async () => {
    await expect(
      userService.createEmployee(validInput, { actorRole: ROLE.EMPLOYEE })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_ROLE' });
    expect(hoisted.getByEmail).not.toHaveBeenCalled();
    expect(hoisted.createEmployee).not.toHaveBeenCalled();
  });

  it('rejects an invalid email with a 400 + fieldErrors.email', async () => {
    await expect(
      userService.createEmployee({ ...validInput, email: 'not-an-email' }, { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR', fieldErrors: { email: expect.any(String) } });
    expect(hoisted.createEmployee).not.toHaveBeenCalled();
  });

  it('rejects a missing displayName with fieldErrors.displayName', async () => {
    await expect(
      userService.createEmployee({ ...validInput, displayName: '   ' }, { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ fieldErrors: { displayName: expect.any(String) } });
  });

  it('rejects a temporary password shorter than 8 characters', async () => {
    await expect(
      userService.createEmployee({ ...validInput, temporaryPassword: 'short' }, { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ fieldErrors: { temporaryPassword: expect.any(String) } });
  });

  it('rejects an email that already belongs to an existing user (409-free 400 conflict)', async () => {
    hoisted.getByEmail.mockResolvedValue({ id: 'existing-user' });

    await expect(userService.createEmployee(validInput, { actorRole: ROLE.OWNER })).rejects.toMatchObject({
      statusCode: 400,
      fieldErrors: { email: expect.any(String) },
    });
    expect(hoisted.createEmployee).not.toHaveBeenCalled();
  });

  it('normalizes email/displayName, hashes the password, and always creates role EMPLOYEE', async () => {
    hoisted.getByEmail.mockResolvedValue(null);
    hoisted.createEmployee.mockResolvedValue({ id: 'new-user', role: ROLE.EMPLOYEE });

    const result = await userService.createEmployee(validInput, { actorRole: ROLE.OWNER });

    expect(hoisted.hashPassword).toHaveBeenCalledWith('temp12345');
    expect(hoisted.createEmployee).toHaveBeenCalledWith({
      email: 'new.employee@example.com',
      passwordHash: 'hashed-password',
      displayName: 'Noa Cohen',
    });
    expect(result).toEqual({ id: 'new-user', role: ROLE.EMPLOYEE });
  });
});

describe('userService.getUserDetail', () => {
  it('throws 403 for a non-OWNER actor and never touches the repository', async () => {
    await expect(userService.getUserDetail('user-1', { actorRole: ROLE.EMPLOYEE })).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN_ROLE',
    });
    expect(hoisted.getSafeById).not.toHaveBeenCalled();
  });

  it('throws 404 when the user does not exist', async () => {
    hoisted.getSafeById.mockResolvedValue(null);
    await expect(userService.getUserDetail('missing-user', { actorRole: ROLE.OWNER })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('returns the safe user projection for an OWNER actor', async () => {
    hoisted.getSafeById.mockResolvedValue({ id: 'user-1', email: 'user@example.com', role: ROLE.EMPLOYEE });

    const result = await userService.getUserDetail('user-1', { actorRole: ROLE.OWNER });

    expect(hoisted.getSafeById).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ id: 'user-1', email: 'user@example.com', role: ROLE.EMPLOYEE });
  });
});

describe('userService.updateDisplayName', () => {
  it('throws 403 for a non-OWNER actor', async () => {
    await expect(
      userService.updateDisplayName('user-1', 'New Name', { actorRole: ROLE.EMPLOYEE })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(hoisted.getById).not.toHaveBeenCalled();
  });

  it('throws 404 when the target user does not exist', async () => {
    hoisted.getById.mockResolvedValue(null);
    await expect(
      userService.updateDisplayName('missing-user', 'New Name', { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects an empty displayName', async () => {
    hoisted.getById.mockResolvedValue({ id: 'user-1' });
    await expect(
      userService.updateDisplayName('user-1', '   ', { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(hoisted.updateDisplayName).not.toHaveBeenCalled();
  });

  it('trims and forwards a valid displayName', async () => {
    hoisted.getById.mockResolvedValue({ id: 'user-1' });
    hoisted.updateDisplayName.mockResolvedValue({ id: 'user-1', displayName: 'New Name' });

    const result = await userService.updateDisplayName('user-1', '  New Name  ', { actorRole: ROLE.OWNER });

    expect(hoisted.updateDisplayName).toHaveBeenCalledWith('user-1', 'New Name');
    expect(result).toEqual({ id: 'user-1', displayName: 'New Name' });
  });
});

describe('userService.updateEmail', () => {
  it('throws 403 for a non-OWNER actor and never touches the repository', async () => {
    await expect(
      userService.updateEmail('user-1', 'new@example.com', { actorRole: ROLE.EMPLOYEE })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_ROLE' });
    expect(hoisted.getById).not.toHaveBeenCalled();
    expect(hoisted.updateEmail).not.toHaveBeenCalled();
  });

  it('rejects an invalid email with a 400 + fieldErrors.email', async () => {
    await expect(
      userService.updateEmail('user-1', 'not-an-email', { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      fieldErrors: { email: expect.any(String) },
    });
    expect(hoisted.getById).not.toHaveBeenCalled();
  });

  it('rejects a missing/non-string email', async () => {
    await expect(userService.updateEmail('user-1', undefined, { actorRole: ROLE.OWNER })).rejects.toMatchObject({
      statusCode: 400,
      fieldErrors: { email: expect.any(String) },
    });
  });

  it('throws 404 when the target user does not exist', async () => {
    hoisted.getById.mockResolvedValue(null);
    await expect(
      userService.updateEmail('missing-user', 'new@example.com', { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(hoisted.updateEmail).not.toHaveBeenCalled();
  });

  it('rejects an email already used by a different user', async () => {
    hoisted.getById.mockResolvedValue({ id: 'user-1', email: 'old@example.com' });
    hoisted.getByEmail.mockResolvedValue({ id: 'other-user' });

    await expect(
      userService.updateEmail('user-1', 'taken@example.com', { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 400, fieldErrors: { email: expect.any(String) } });
    expect(hoisted.updateEmail).not.toHaveBeenCalled();
  });

  it('allows re-saving the user\'s own current email (no false "taken" conflict)', async () => {
    hoisted.getById.mockResolvedValue({ id: 'user-1', email: 'same@example.com' });
    hoisted.updateEmail.mockResolvedValue({ id: 'user-1', email: 'same@example.com' });

    const result = await userService.updateEmail('user-1', 'Same@Example.com', { actorRole: ROLE.OWNER });

    expect(hoisted.getByEmail).not.toHaveBeenCalled();
    expect(hoisted.updateEmail).toHaveBeenCalledWith('user-1', 'same@example.com');
    expect(result).toEqual({ id: 'user-1', email: 'same@example.com' });
  });

  it('normalizes (trims/lowercases) and forwards a valid, available email', async () => {
    hoisted.getById.mockResolvedValue({ id: 'user-1', email: 'old@example.com' });
    hoisted.getByEmail.mockResolvedValue(null);
    hoisted.updateEmail.mockResolvedValue({ id: 'user-1', email: 'new@example.com' });

    const result = await userService.updateEmail('user-1', '  New@Example.com  ', { actorRole: ROLE.OWNER });

    expect(hoisted.getByEmail).toHaveBeenCalledWith('new@example.com');
    expect(hoisted.updateEmail).toHaveBeenCalledWith('user-1', 'new@example.com');
    expect(result).toEqual({ id: 'user-1', email: 'new@example.com' });
  });
});

describe('userService.setActive', () => {
  it('throws 403 for a non-OWNER actor', async () => {
    await expect(
      userService.setActive('user-1', false, { actorId: 'owner-1', actorRole: ROLE.EMPLOYEE })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(hoisted.getById).not.toHaveBeenCalled();
  });

  it('throws 404 when the target user does not exist', async () => {
    hoisted.getById.mockResolvedValue(null);
    await expect(
      userService.setActive('missing-user', false, { actorId: 'owner-1', actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('blocks an Owner from disabling their own account (CANNOT_DISABLE_SELF)', async () => {
    hoisted.getById.mockResolvedValue({ id: 'owner-1', role: ROLE.OWNER, isActive: true });

    await expect(
      userService.setActive('owner-1', false, { actorId: 'owner-1', actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 409, code: 'CANNOT_DISABLE_SELF' });
    expect(hoisted.setActive).not.toHaveBeenCalled();
    expect(hoisted.setActiveAndRevokeSessions).not.toHaveBeenCalled();
  });

  it('blocks disabling the only active Owner even when a different Owner is asking (CANNOT_DISABLE_ONLY_OWNER)', async () => {
    hoisted.getById.mockResolvedValue({ id: 'owner-2', role: ROLE.OWNER, isActive: true });
    hoisted.countActiveOwners.mockResolvedValue(1);

    await expect(
      userService.setActive('owner-2', false, { actorId: 'owner-1', actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 409, code: 'CANNOT_DISABLE_ONLY_OWNER' });
    expect(hoisted.setActive).not.toHaveBeenCalled();
    expect(hoisted.setActiveAndRevokeSessions).not.toHaveBeenCalled();
  });

  it('allows disabling an Owner when another active Owner still remains (via the atomic composite)', async () => {
    hoisted.getById.mockResolvedValue({ id: 'owner-2', role: ROLE.OWNER, isActive: true });
    hoisted.countActiveOwners.mockResolvedValue(2);
    hoisted.setActiveAndRevokeSessions.mockResolvedValue({ id: 'owner-2', isActive: false });

    const result = await userService.setActive('owner-2', false, { actorId: 'owner-1', actorRole: ROLE.OWNER });

    expect(hoisted.setActiveAndRevokeSessions).toHaveBeenCalledWith('owner-2', false);
    expect(result).toEqual({ id: 'owner-2', isActive: false });
  });

  it('allows disabling an EMPLOYEE with no owner-count check at all (via the atomic composite)', async () => {
    hoisted.getById.mockResolvedValue({ id: 'employee-1', role: ROLE.EMPLOYEE, isActive: true });
    hoisted.setActiveAndRevokeSessions.mockResolvedValue({ id: 'employee-1', isActive: false });

    const result = await userService.setActive('employee-1', false, { actorId: 'owner-1', actorRole: ROLE.OWNER });

    expect(hoisted.countActiveOwners).not.toHaveBeenCalled();
    expect(hoisted.setActiveAndRevokeSessions).toHaveBeenCalledWith('employee-1', false);
    expect(result).toEqual({ id: 'employee-1', isActive: false });
  });

  it('never blocks re-activating a user, even the acting Owner themselves', async () => {
    hoisted.getById.mockResolvedValue({ id: 'owner-1', role: ROLE.OWNER, isActive: false });
    hoisted.setActive.mockResolvedValue({ id: 'owner-1', isActive: true });

    const result = await userService.setActive('owner-1', true, { actorId: 'owner-1', actorRole: ROLE.OWNER });

    expect(hoisted.countActiveOwners).not.toHaveBeenCalled();
    expect(hoisted.setActive).toHaveBeenCalledWith('owner-1', true);
    expect(result).toEqual({ id: 'owner-1', isActive: true });
  });

  // Sprint 3a (Session Security Foundation) — the service picks the right
  // repository mechanism: deactivation MUST ride the atomic
  // user-update+revoke-all composite; reactivation MUST NOT (revokedAt is
  // set-once — reactivating never resurrects old sessions).
  describe('Sprint 3a — session revocation wiring', () => {
    it('deactivation calls ONLY the composite, never the plain setActive', async () => {
      hoisted.getById.mockResolvedValue({ id: 'employee-1', role: ROLE.EMPLOYEE, isActive: true });
      hoisted.setActiveAndRevokeSessions.mockResolvedValue({ id: 'employee-1', isActive: false });

      await userService.setActive('employee-1', false, { actorId: 'owner-1', actorRole: ROLE.OWNER });

      expect(hoisted.setActiveAndRevokeSessions).toHaveBeenCalledWith('employee-1', false);
      expect(hoisted.setActive).not.toHaveBeenCalled();
    });

    it('reactivation calls ONLY the plain setActive, never the composite (S13: old sessions stay revoked)', async () => {
      hoisted.getById.mockResolvedValue({ id: 'employee-1', role: ROLE.EMPLOYEE, isActive: false });
      hoisted.setActive.mockResolvedValue({ id: 'employee-1', isActive: true });

      await userService.setActive('employee-1', true, { actorId: 'owner-1', actorRole: ROLE.OWNER });

      expect(hoisted.setActive).toHaveBeenCalledWith('employee-1', true);
      expect(hoisted.setActiveAndRevokeSessions).not.toHaveBeenCalled();
    });

    it('a failed atomic deactivation propagates and emits no event (S8: nothing committed, nothing reported)', async () => {
      hoisted.getById.mockResolvedValue({ id: 'employee-1', role: ROLE.EMPLOYEE, isActive: true });
      hoisted.setActiveAndRevokeSessions.mockRejectedValue(new Error('tx rolled back'));

      await expect(
        userService.setActive('employee-1', false, { actorId: 'owner-1', actorRole: ROLE.OWNER })
      ).rejects.toThrow('tx rolled back');
      expect(hoisted.emit).not.toHaveBeenCalled();
    });

    it('a failed atomic password reset propagates and emits no event (S9)', async () => {
      hoisted.getSafeById.mockResolvedValue({ id: 'user-1' });
      hoisted.updatePasswordHashAndRevokeSessions.mockRejectedValue(new Error('tx rolled back'));

      await expect(
        userService.resetPassword('user-1', 'newtemp123', { actorRole: ROLE.OWNER })
      ).rejects.toThrow('tx rolled back');
      expect(hoisted.emit).not.toHaveBeenCalled();
    });
  });
});

/*
 * Administration Sprint 2b — event emission.
 *
 * Verifies the five mutations each emit exactly one correct event AFTER
 * the repository write succeeds, that failed/rejected mutations emit
 * nothing, that payloads are allowlist-only (no credential material, no
 * row spreads), and the committed-mutation-wins consistency decision (an
 * Event-persist failure never fails a mutation that already committed).
 */
describe('Sprint 2b — event emission', () => {
  const actorContext = {
    actorId: 'owner-1',
    actorRole: ROLE.OWNER,
    correlationId: 'corr-req-1',
    requestMetadata: { ipAddress: '203.0.113.7', userAgent: 'vitest' },
  };

  describe('UserCreated', () => {
    const validInput = {
      email: 'new.employee@example.com',
      displayName: 'Noa Cohen',
      temporaryPassword: 'temp12345',
    };

    it('emits exactly one UserCreated with actor id, target id, and the allowlisted payload only', async () => {
      hoisted.getByEmail.mockResolvedValue(null);
      hoisted.createEmployee.mockResolvedValue({
        id: 'new-user',
        email: 'new.employee@example.com',
        displayName: 'Noa Cohen',
        role: ROLE.EMPLOYEE,
      });

      await userService.createEmployee(validInput, actorContext);

      expect(hoisted.emit).toHaveBeenCalledTimes(1);
      expect(hoisted.emit).toHaveBeenCalledWith(EVENT_TYPE.USER_CREATED, {
        entityType: ENTITY_TYPE.USER,
        entityId: 'new-user',
        actorId: 'owner-1',
        correlationId: 'corr-req-1',
        payload: {
          email: 'new.employee@example.com',
          displayName: 'Noa Cohen',
          role: ROLE.EMPLOYEE,
        },
        metadata: { ipAddress: '203.0.113.7', userAgent: 'vitest' },
      });
    });

    it('never lets the temporary password, its hash, or a length hint into the emit call', async () => {
      hoisted.getByEmail.mockResolvedValue(null);
      hoisted.createEmployee.mockResolvedValue({
        id: 'new-user',
        email: 'new.employee@example.com',
        displayName: 'Noa Cohen',
        role: ROLE.EMPLOYEE,
      });

      await userService.createEmployee(validInput, actorContext);

      const serialized = JSON.stringify(hoisted.emit.mock.calls[0]);
      expect(serialized).not.toContain('temp12345');
      expect(serialized).not.toContain('hashed-password');
      expect(serialized.toLowerCase()).not.toContain('password');
      expect(serialized.toLowerCase()).not.toContain('hash');
      expect(serialized.toLowerCase()).not.toContain('length');
    });

    it('emits nothing on validation failure', async () => {
      await expect(
        userService.createEmployee({ ...validInput, email: 'not-an-email' }, actorContext)
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(hoisted.emit).not.toHaveBeenCalled();
    });

    it('emits nothing on duplicate-email failure', async () => {
      hoisted.getByEmail.mockResolvedValue({ id: 'existing-user' });
      await expect(userService.createEmployee(validInput, actorContext)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(hoisted.emit).not.toHaveBeenCalled();
    });

    it('emits nothing for a non-OWNER actor (rejected mutation)', async () => {
      await expect(
        userService.createEmployee(validInput, { ...actorContext, actorRole: ROLE.EMPLOYEE })
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(hoisted.emit).not.toHaveBeenCalled();
    });
  });

  describe('UserDetailsUpdated', () => {
    it('displayName change emits exactly one event with safe before/after (that field only)', async () => {
      hoisted.getById.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        displayName: 'Old Name',
        passwordHash: 'SECRET-HASH',
      });
      hoisted.updateDisplayName.mockResolvedValue({ id: 'user-1', displayName: 'New Name' });

      await userService.updateDisplayName('user-1', 'New Name', actorContext);

      expect(hoisted.emit).toHaveBeenCalledTimes(1);
      expect(hoisted.emit).toHaveBeenCalledWith(EVENT_TYPE.USER_DETAILS_UPDATED, {
        entityType: ENTITY_TYPE.USER,
        entityId: 'user-1',
        actorId: 'owner-1',
        correlationId: 'corr-req-1',
        payload: {
          changedFields: ['displayName'],
          before: { displayName: 'Old Name' },
          after: { displayName: 'New Name' },
        },
        metadata: { ipAddress: '203.0.113.7', userAgent: 'vitest' },
      });
      // The pre-fetched target row contained a passwordHash — prove the
      // allowlist kept it out.
      expect(JSON.stringify(hoisted.emit.mock.calls[0])).not.toContain('SECRET-HASH');
    });

    it('email change emits exactly one event with safe before/after (that field only)', async () => {
      hoisted.getById.mockResolvedValue({
        id: 'user-1',
        email: 'old@example.com',
        displayName: 'Name',
        passwordHash: 'SECRET-HASH',
      });
      hoisted.getByEmail.mockResolvedValue(null);
      hoisted.updateEmail.mockResolvedValue({ id: 'user-1', email: 'new@example.com' });

      await userService.updateEmail('user-1', 'new@example.com', actorContext);

      expect(hoisted.emit).toHaveBeenCalledTimes(1);
      expect(hoisted.emit).toHaveBeenCalledWith(EVENT_TYPE.USER_DETAILS_UPDATED, {
        entityType: ENTITY_TYPE.USER,
        entityId: 'user-1',
        actorId: 'owner-1',
        correlationId: 'corr-req-1',
        payload: {
          changedFields: ['email'],
          before: { email: 'old@example.com' },
          after: { email: 'new@example.com' },
        },
        metadata: { ipAddress: '203.0.113.7', userAgent: 'vitest' },
      });
      expect(JSON.stringify(hoisted.emit.mock.calls[0])).not.toContain('SECRET-HASH');
    });

    it('emits nothing when displayName validation fails', async () => {
      hoisted.getById.mockResolvedValue({ id: 'user-1' });
      await expect(userService.updateDisplayName('user-1', '   ', actorContext)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(hoisted.emit).not.toHaveBeenCalled();
    });

    it('emits nothing on duplicate-email failure', async () => {
      hoisted.getById.mockResolvedValue({ id: 'user-1', email: 'old@example.com' });
      hoisted.getByEmail.mockResolvedValue({ id: 'other-user' });
      await expect(
        userService.updateEmail('user-1', 'taken@example.com', actorContext)
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(hoisted.emit).not.toHaveBeenCalled();
    });

    it('emits nothing when the target does not exist', async () => {
      hoisted.getById.mockResolvedValue(null);
      await expect(
        userService.updateDisplayName('missing-user', 'New Name', actorContext)
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(hoisted.emit).not.toHaveBeenCalled();
    });
  });

  describe('UserActivated / UserDeactivated stay distinct', () => {
    it('activation emits exactly one UserActivated (never UserDeactivated)', async () => {
      hoisted.getById.mockResolvedValue({ id: 'employee-1', role: ROLE.EMPLOYEE, isActive: false });
      hoisted.setActive.mockResolvedValue({ id: 'employee-1', isActive: true });

      await userService.setActive('employee-1', true, actorContext);

      expect(hoisted.emit).toHaveBeenCalledTimes(1);
      expect(hoisted.emit).toHaveBeenCalledWith(EVENT_TYPE.USER_ACTIVATED, {
        entityType: ENTITY_TYPE.USER,
        entityId: 'employee-1',
        actorId: 'owner-1',
        correlationId: 'corr-req-1',
        payload: {},
        metadata: { ipAddress: '203.0.113.7', userAgent: 'vitest' },
      });
    });

    it('deactivation emits exactly one UserDeactivated (never UserActivated)', async () => {
      hoisted.getById.mockResolvedValue({ id: 'employee-1', role: ROLE.EMPLOYEE, isActive: true });
      hoisted.setActiveAndRevokeSessions.mockResolvedValue({ id: 'employee-1', isActive: false });

      await userService.setActive('employee-1', false, actorContext);

      expect(hoisted.emit).toHaveBeenCalledTimes(1);
      expect(hoisted.emit).toHaveBeenCalledWith(
        EVENT_TYPE.USER_DEACTIVATED,
        expect.objectContaining({ entityId: 'employee-1', actorId: 'owner-1', payload: {} })
      );
    });

    it('self-deactivation failure emits nothing', async () => {
      hoisted.getById.mockResolvedValue({ id: 'owner-1', role: ROLE.OWNER, isActive: true });
      await expect(userService.setActive('owner-1', false, actorContext)).rejects.toMatchObject({
        code: 'CANNOT_DISABLE_SELF',
      });
      expect(hoisted.emit).not.toHaveBeenCalled();
    });

    it('last-active-owner deactivation failure emits nothing', async () => {
      hoisted.getById.mockResolvedValue({ id: 'owner-2', role: ROLE.OWNER, isActive: true });
      hoisted.countActiveOwners.mockResolvedValue(1);
      await expect(userService.setActive('owner-2', false, actorContext)).rejects.toMatchObject({
        code: 'CANNOT_DISABLE_ONLY_OWNER',
      });
      expect(hoisted.emit).not.toHaveBeenCalled();
    });
  });

  describe('UserPasswordReset', () => {
    it('emits exactly one UserPasswordReset with an EMPTY payload — no password, hash, credential, or length hint', async () => {
      hoisted.getSafeById.mockResolvedValue({ id: 'user-1' });
      hoisted.updatePasswordHashAndRevokeSessions.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });

      await userService.resetPassword('user-1', 'newtemp123', actorContext);

      expect(hoisted.emit).toHaveBeenCalledTimes(1);
      expect(hoisted.emit).toHaveBeenCalledWith(EVENT_TYPE.USER_PASSWORD_RESET, {
        entityType: ENTITY_TYPE.USER,
        entityId: 'user-1',
        actorId: 'owner-1',
        correlationId: 'corr-req-1',
        payload: {},
        metadata: { ipAddress: '203.0.113.7', userAgent: 'vitest' },
      });

      const [, emitted] = hoisted.emit.mock.calls[0];
      expect(emitted.payload).toEqual({});
      // Whole call: the plaintext and hash must appear nowhere at all.
      const wholeCall = JSON.stringify(hoisted.emit.mock.calls[0]);
      expect(wholeCall).not.toContain('newtemp123');
      expect(wholeCall).not.toContain('hashed-password');
      // Payload + metadata (the persisted business/technical data): no
      // credential-shaped key or length hint of any kind. (The event TYPE
      // string is legitimately "UserPasswordReset", so it is excluded.)
      const persisted = JSON.stringify({ payload: emitted.payload, metadata: emitted.metadata }).toLowerCase();
      expect(persisted).not.toContain('password');
      expect(persisted).not.toContain('hash');
      expect(persisted).not.toContain('length');
    });

    it('emits nothing when password validation fails', async () => {
      await expect(userService.resetPassword('user-1', 'short', actorContext)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(hoisted.emit).not.toHaveBeenCalled();
    });
  });

  describe('consistency — committed mutation wins over a failed Event persist', () => {
    it('still returns success (and the repo result) when eventService.emit rejects after the write committed', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      hoisted.getById.mockResolvedValue({ id: 'user-1', displayName: 'Old Name' });
      hoisted.updateDisplayName.mockResolvedValue({ id: 'user-1', displayName: 'New Name' });
      hoisted.emit.mockRejectedValue(new Error('event table unavailable'));

      const result = await userService.updateDisplayName('user-1', 'New Name', actorContext);

      expect(result).toEqual({ id: 'user-1', displayName: 'New Name' });
      // The audit gap is loudly logged instead of silently swallowed.
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('AUDIT GAP'),
        expect.any(Error)
      );
      consoleError.mockRestore();
    });

    it('emits only after the repository write succeeds — a failing write means no event', async () => {
      hoisted.getById.mockResolvedValue({ id: 'user-1', displayName: 'Old Name' });
      hoisted.updateDisplayName.mockRejectedValue(new Error('db write failed'));

      await expect(
        userService.updateDisplayName('user-1', 'New Name', actorContext)
      ).rejects.toThrow('db write failed');
      expect(hoisted.emit).not.toHaveBeenCalled();
    });
  });
});

describe('userService.resetPassword', () => {
  it('throws 403 for a non-OWNER actor and never touches the repository', async () => {
    await expect(
      userService.resetPassword('user-1', 'temp12345', { actorRole: ROLE.EMPLOYEE })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_ROLE' });
    expect(hoisted.getSafeById).not.toHaveBeenCalled();
    expect(hoisted.updatePasswordHashAndRevokeSessions).not.toHaveBeenCalled();
  });

  it('rejects a temporary password shorter than 8 characters', async () => {
    await expect(
      userService.resetPassword('user-1', 'short', { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      fieldErrors: { temporaryPassword: expect.any(String) },
    });
    expect(hoisted.getSafeById).not.toHaveBeenCalled();
  });

  it('rejects a missing/non-string temporary password', async () => {
    await expect(userService.resetPassword('user-1', undefined, { actorRole: ROLE.OWNER })).rejects.toMatchObject({
      statusCode: 400,
      fieldErrors: { temporaryPassword: expect.any(String) },
    });
  });

  it('throws 404 when the target user does not exist', async () => {
    hoisted.getSafeById.mockResolvedValue(null);
    await expect(
      userService.resetPassword('missing-user', 'temp12345', { actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(hoisted.updatePasswordHashAndRevokeSessions).not.toHaveBeenCalled();
  });

  it('hashes the new password and forwards it to the ATOMIC composite (never the plain update — Sprint 3a)', async () => {
    hoisted.getSafeById.mockResolvedValue({ id: 'user-1' });
    hoisted.updatePasswordHashAndRevokeSessions.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });

    const result = await userService.resetPassword('user-1', 'newtemp123', { actorRole: ROLE.OWNER });

    expect(hoisted.hashPassword).toHaveBeenCalledWith('newtemp123');
    expect(hoisted.updatePasswordHashAndRevokeSessions).toHaveBeenCalledWith('user-1', 'hashed-password');
    expect(hoisted.updatePasswordHash).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'user-1', email: 'user@example.com' });
  });
});
