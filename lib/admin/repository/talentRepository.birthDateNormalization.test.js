/*
 * Save Draft birthDate regression fix — locks the one normalization this
 * fix adds (normalizeBirthDateForPrisma, talentRepository.js) at every
 * write site that accepts a `birthDate` business field:
 * updateTalentVersionFields (the path the unified Details Save Draft PATCH
 * actually calls, and the one that crashed in production with
 * PrismaClientValidationError: "Invalid value for argument birthDate:
 * premature end of input. Expected ISO-8601 DateTime."), plus
 * insertTalentVersion/createTalentWithInitialVersion (Talent creation),
 * which shared the exact same latent, previously-untested defect but
 * happened never to be exercised with a real date string in production.
 *
 * Prisma is mocked (no test may touch a real database/network — same rule
 * as every other suite in this file's siblings:
 * talentRepository.updateTalentVersionFields.test.js,
 * talentRepository.createTalentWithInitialVersion.test.js). The mocked
 * `update`/`create` calls simply echo back whatever `data` they're given,
 * so these tests assert on the exact `data` object the repository hands
 * Prisma — the only place normalization can happen before the (real, in
 * production) Prisma client would reject a bare 'YYYY-MM-DD' string.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const update = vi.fn(async ({ where, data }) => ({ id: where.id, ...data }));
const findUnique = vi.fn(async ({ where }) => ({ id: where.id }));
const versionCreate = vi.fn(async ({ data }) => ({ id: 'v-new', ...data }));
const talentCreate = vi.fn(async ({ data }) => ({ id: 't-new', ...data }));
const transaction = vi.fn(async (fn) =>
  fn({ talent: { create: talentCreate }, talentVersion: { create: versionCreate } })
);

vi.mock('@/lib/admin/db', () => ({
  prisma: {
    talentVersion: {
      update: (...args) => update(...args),
      findUnique: (...args) => findUnique(...args),
      create: (...args) => versionCreate(...args),
    },
    $transaction: (fn) => transaction(fn),
  },
  isDatabaseConfigured: true,
}));

import { talentRepository } from '@/lib/admin/repository/talentRepository';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updateTalentVersionFields — birthDate normalization (Save Draft regression fix)', () => {
  it('normalizes a UI-supplied "YYYY-MM-DD" string into a Prisma-valid Date before the write', async () => {
    await talentRepository.updateTalentVersionFields('v-1', { birthDate: '2005-02-05' });

    expect(update).toHaveBeenCalledOnce();
    const { data } = update.mock.calls[0][0];
    expect(data.birthDate).toBeInstanceOf(Date);
    // A bare Prisma DateTime string would have been rejected with
    // "premature end of input. Expected ISO-8601 DateTime." — a real Date
    // instance is exactly what the client needs instead.
  });

  it('keeps an explicit null as null (clearing to "no birth date" is a deliberate write, not an omission)', async () => {
    await talentRepository.updateTalentVersionFields('v-1', { birthDate: null });

    const { data } = update.mock.calls[0][0];
    expect(data.birthDate).toBeNull();
  });

  it('clears an existing birthDate: a real date string this save, then null the next save, both write correctly', async () => {
    await talentRepository.updateTalentVersionFields('v-1', { birthDate: '2005-02-05' });
    const firstWrite = update.mock.calls[0][0].data;
    expect(firstWrite.birthDate).toBeInstanceOf(Date);
    expect(firstWrite.birthDate.toISOString().slice(0, 10)).toBe('2005-02-05');

    update.mockClear();
    await talentRepository.updateTalentVersionFields('v-1', { birthDate: null });
    const secondWrite = update.mock.calls[0][0].data;
    expect(secondWrite.birthDate).toBeNull();
  });

  it('does not shift the calendar date by a day, for dates near a UTC day/month/year boundary', async () => {
    const cases = ['2005-02-05', '1999-12-31', '2000-01-01', '2024-02-29'];

    for (const input of cases) {
      update.mockClear();
      await talentRepository.updateTalentVersionFields('v-1', { birthDate: input });
      const { data } = update.mock.calls[0][0];
      expect(data.birthDate.toISOString().slice(0, 10)).toBe(input);
    }
  });

  it('leaves every ordinary field in the same combined Save Draft payload untouched', async () => {
    // The exact shape of a real unified Details Save Draft payload:
    // ordinary text/list fields alongside the flattened profile-image
    // columns (TalentDetailsEditor.buildSaveFields) and birthDate — all in
    // one PATCH, per the Talent Details Lifecycle Unification sprint.
    await talentRepository.updateTalentVersionFields('v-1', {
      name: 'שם לדוגמה',
      bioHe: 'ביוגרפיה לדוגמה',
      category: ['acting'],
      tags: ['tag-1'],
      featured: true,
      profileImagePosition: '37.2% 61.8%',
      profileImageScale: 1.4,
      birthDate: '2005-02-05',
    });

    const { data } = update.mock.calls[0][0];
    expect(data.name).toBe('שם לדוגמה');
    expect(data.bioHe).toBe('ביוגרפיה לדוגמה');
    expect(data.category).toEqual(['acting']);
    expect(data.tags).toEqual(['tag-1']);
    expect(data.featured).toBe(true);
    expect(data.profileImagePosition).toBe('37.2% 61.8%');
    expect(data.profileImageScale).toBe(1.4);
    // birthDate is the one field this fix transforms.
    expect(data.birthDate).toBeInstanceOf(Date);
    expect(data.birthDate.toISOString().slice(0, 10)).toBe('2005-02-05');
  });

  it('leaves an already-Date birthDate value untouched (e.g. an upstream caller that already normalized)', async () => {
    const alreadyDate = new Date('1990-06-15');
    await talentRepository.updateTalentVersionFields('v-1', { birthDate: alreadyDate });

    const { data } = update.mock.calls[0][0];
    expect(data.birthDate).toBe(alreadyDate);
  });

  it('an absent birthDate key still leaves the column untouched entirely (no key in `data` at all)', async () => {
    await talentRepository.updateTalentVersionFields('v-1', { name: 'שם' });

    const { data } = update.mock.calls[0][0];
    expect(data).not.toHaveProperty('birthDate');
  });
});

describe('Talent creation — birthDate consistency with the same normalization (no second date convention)', () => {
  it('insertTalentVersion normalizes a "YYYY-MM-DD" birthDate the same way updateTalentVersionFields does', async () => {
    await talentRepository.insertTalentVersion({
      talentId: 't-1',
      fields: { name: 'שם', birthDate: '2005-02-05' },
      status: 'DRAFT',
      createdById: 'user-1',
    });

    const { data } = versionCreate.mock.calls[0][0];
    expect(data.birthDate).toBeInstanceOf(Date);
    expect(data.birthDate.toISOString().slice(0, 10)).toBe('2005-02-05');
  });

  it('insertTalentVersion still passes an already-Date birthDate through untouched (Draft seeded from a Published version via extractTalentVersionFields)', async () => {
    const alreadyDate = new Date('1990-06-15');
    await talentRepository.insertTalentVersion({
      talentId: 't-1',
      fields: { name: 'שם', birthDate: alreadyDate },
      status: 'DRAFT',
      createdById: 'user-1',
    });

    const { data } = versionCreate.mock.calls[0][0];
    expect(data.birthDate).toBe(alreadyDate);
  });

  it('insertTalentVersion still writes null/undefined birthDate unchanged, exactly as before this fix (existing creation behavior preserved)', async () => {
    await talentRepository.insertTalentVersion({
      talentId: 't-1',
      fields: { name: 'שם' }, // no birthDate at all — the common "new Talent" case
      status: 'DRAFT',
      createdById: 'user-1',
    });

    const { data } = versionCreate.mock.calls[0][0];
    expect(data.birthDate).toBeUndefined();
  });

  it('createTalentWithInitialVersion normalizes a "YYYY-MM-DD" birthDate the same way', async () => {
    await talentRepository.createTalentWithInitialVersion({
      slug: 'new-talent',
      createdById: 'user-1',
      fields: { name: 'שם', birthDate: '2005-02-05' },
    });

    const { data } = versionCreate.mock.calls[0][0];
    expect(data.birthDate).toBeInstanceOf(Date);
    expect(data.birthDate.toISOString().slice(0, 10)).toBe('2005-02-05');
  });

  it('createTalentWithInitialVersion leaves the common no-birthDate creation case exactly as before (existing behavior consistent)', async () => {
    await talentRepository.createTalentWithInitialVersion({
      slug: 'new-talent',
      createdById: 'user-1',
      fields: { name: 'שם' },
    });

    const { data } = versionCreate.mock.calls[0][0];
    expect(data.birthDate).toBeUndefined();
  });
});
