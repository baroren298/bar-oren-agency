/*
 * Talent Archive & Restore feature — shared guard used by every write
 * route that can either create a new pending edit or make one live
 * (proposals create/approve/direct-publish, socials/gallery approve +
 * direct-publish). An archived talent must stay read-only: nothing may
 * start a new Draft on it, and nothing already in flight (a DRAFT/PROPOSED
 * row that predates the archive) may be approved or published while it's
 * archived — the only way out is Restore (app/api/admin/talent/[id]/
 * restore/route.js), which is OWNER-only and independent of this guard.
 *
 * Deliberately NOT guarding Reject/Discard/Submit: none of those make
 * anything newly visible (reject and discard remove a pending edit;
 * submit only moves DRAFT -> PROPOSED, still gated from ever reaching
 * PUBLISHED by the approve/publish guards below), so blocking them would
 * only prevent cleanup without protecting anything.
 *
 * Pure predicate + response-builder, no decision beyond "is this talent's
 * own status ARCHIVED" — same thin-helper shape as every other
 * route-level check in this codebase, not a new engine/service layer.
 */

import { NextResponse } from 'next/server';
import { LIFECYCLE_STATUS } from './constants/enums';
import { he } from './i18n/he';

/** @param {{ status: string }|null} talent */
export function isTalentArchived(talent) {
  return talent?.status === LIFECYCLE_STATUS.ARCHIVED;
}

/**
 * 409 response for a write attempted against an archived talent. Callers
 * check `isTalentArchived(talent)` first and return this directly — same
 * shape every sibling route already uses for its own conflict responses.
 */
export function talentArchivedResponse() {
  return NextResponse.json(
    { error: he.talent.archive.errors.talentArchivedReadOnly, code: 'TALENT_ARCHIVED' },
    { status: 409 }
  );
}
