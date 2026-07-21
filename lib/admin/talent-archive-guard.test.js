/*
 * talent-archive-guard — unit coverage for the shared predicate/response
 * used by every write route that must reject an archived talent (see that
 * file's header for the full list of guarded routes).
 */
import { describe, it, expect } from 'vitest';
import { isTalentArchived, talentArchivedResponse } from './talent-archive-guard';
import { LIFECYCLE_STATUS } from './constants/enums';
import { he } from './i18n/he';

describe('isTalentArchived', () => {
  it('is true only for a talent whose status is ARCHIVED', () => {
    expect(isTalentArchived({ status: LIFECYCLE_STATUS.ARCHIVED })).toBe(true);
  });

  it('is false for ACTIVE, HIDDEN, DELETED, and a missing/null talent', () => {
    expect(isTalentArchived({ status: LIFECYCLE_STATUS.ACTIVE })).toBe(false);
    expect(isTalentArchived({ status: LIFECYCLE_STATUS.HIDDEN })).toBe(false);
    expect(isTalentArchived({ status: LIFECYCLE_STATUS.DELETED })).toBe(false);
    expect(isTalentArchived(null)).toBe(false);
    expect(isTalentArchived(undefined)).toBe(false);
  });
});

describe('talentArchivedResponse', () => {
  it('is a 409 carrying the shared TALENT_ARCHIVED code and Hebrew message', async () => {
    const response = talentArchivedResponse();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('TALENT_ARCHIVED');
    expect(body.error).toBe(he.talent.archive.errors.talentArchivedReadOnly);
  });
});
