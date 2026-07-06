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
  updatePasswordHash: vi.fn(),
  countActiveOwners: vi.fn(),
  hashPassword: vi.fn(),
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
    updatePasswordHash: hoisted.updatePasswordHash,
    countActiveOwners: hoisted.countActiveOwners,
  },
}));

vi.mock('./auth/password', () => ({
  hashPassword: hoisted.hashPassword,
}));

import { userService } from './userService';
import { ROLE } from './constants/enums';

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.hashPassword.mockResolvedValue('hashed-password');
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
  });

  it('blocks disabling the only active Owner even when a different Owner is asking (CANNOT_DISABLE_ONLY_OWNER)', async () => {
    hoisted.getById.mockResolvedValue({ id: 'owner-2', role: ROLE.OWNER, isActive: true });
    hoisted.countActiveOwners.mockResolvedValue(1);

    await expect(
      userService.setActive('owner-2', false, { actorId: 'owner-1', actorRole: ROLE.OWNER })
    ).rejects.toMatchObject({ statusCode: 409, code: 'CANNOT_DISABLE_ONLY_OWNER' });
    expect(hoisted.setActive).not.toHaveBeenCalled();
  });

  it('allows disabling an Owner when another active Owner still remains', async () => {
    hoisted.getById.mockResolvedValue({ id: 'owner-2', role: ROLE.OWNER, isActive: true });
    hoisted.countActiveOwners.mockResolvedValue(2);
    hoisted.setActive.mockResolvedValue({ id: 'owner-2', isActive: false });

    const result = await userService.setActive('owner-2', false, { actorId: 'owner-1', actorRole: ROLE.OWNER });

    expect(hoisted.setActive).toHaveBeenCalledWith('owner-2', false);
    expect(result).toEqual({ id: 'owner-2', isActive: false });
  });

  it('allows disabling an EMPLOYEE with no owner-count check at all', async () => {
    hoisted.getById.mockResolvedValue({ id: 'employee-1', role: ROLE.EMPLOYEE, isActive: true });
    hoisted.setActive.mockResolvedValue({ id: 'employee-1', isActive: false });

    const result = await userService.setActive('employee-1', false, { actorId: 'owner-1', actorRole: ROLE.OWNER });

    expect(hoisted.countActiveOwners).not.toHaveBeenCalled();
    expect(hoisted.setActive).toHaveBeenCalledWith('employee-1', false);
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
});

describe('userService.resetPassword', () => {
  it('throws 403 for a non-OWNER actor and never touches the repository', async () => {
    await expect(
      userService.resetPassword('user-1', 'temp12345', { actorRole: ROLE.EMPLOYEE })
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN_ROLE' });
    expect(hoisted.getSafeById).not.toHaveBeenCalled();
    expect(hoisted.updatePasswordHash).not.toHaveBeenCalled();
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
    expect(hoisted.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('hashes the new password and forwards it to the repository, returning the safe user', async () => {
    hoisted.getSafeById.mockResolvedValue({ id: 'user-1' });
    hoisted.updatePasswordHash.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });

    const result = await userService.resetPassword('user-1', 'newtemp123', { actorRole: ROLE.OWNER });

    expect(hoisted.hashPassword).toHaveBeenCalledWith('newtemp123');
    expect(hoisted.updatePasswordHash).toHaveBeenCalledWith('user-1', 'hashed-password');
    expect(result).toEqual({ id: 'user-1', email: 'user@example.com' });
  });
});
