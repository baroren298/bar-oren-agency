/*
 * Post-Publish Edit Mode Cleanup fix.
 *
 * Bug: after a successful Gallery or Socials "Publish Now," the talent
 * workspace stayed stuck in edit mode — Cancel was required, and Cancel
 * asked to discard a draft even though nothing the user actually did
 * remained unpublished. Root cause: Gallery/Socials rows are never part of
 * TalentVersion, but "Start Editing" (the only way into the page's global
 * edit mode) always creates a TalentVersion DRAFT as a side effect of
 * opening the page into edit mode — even when the user only ever meant to
 * touch Gallery/Socials. If that DRAFT is never itself edited, publishing
 * Gallery/Socials left it behind, and `globalEditing` (derived from its
 * mere existence) stayed stuck true.
 *
 * Fix: app/api/admin/talent/[id]/gallery/publish/route.js and its socials
 * sibling now do one extra, best-effort step after publishing: if a pending
 * TalentVersion DRAFT exists and is identical to Published
 * (talentVersionIsUnchangedFromPublished, lib/admin/talent-workspace.js),
 * discard it too, so the whole workspace correctly falls back to read-only.
 * A DRAFT with real unpublished changes, or an already-submitted PROPOSED
 * version, is never touched.
 *
 * Per this codebase's established convention (see directPublish.test.js's
 * header comment), these tests don't hit the route.js files directly —
 * Next.js route handlers need a live request/params object that's awkward
 * to construct here. Instead, each test exercises the exact same sequence
 * of engine calls the routes now perform (getCurrentDraftOrProposed ->
 * talentVersionIsUnchangedFromPublished -> proposalService.discard),
 * against the same fakeTalentAdapter proposalLifecycle.test.js and
 * directPublish.test.js already use.
 */
import { describe, it, expect } from 'vitest';
import { proposalService } from '../proposalService';
import { approvalService } from '../approvalService';
import { versionService } from '../versionService';
import { ROLE, VERSION_STATUS } from '../../constants/enums';
import { createFakeTalentAdapter } from './fakes/fakeTalentAdapter';
import {
  extractTalentVersionFields,
  talentVersionIsUnchangedFromPublished,
} from '../../talent-workspace';

/**
 * fakeTalentAdapter's in-memory store keeps a version's business fields
 * nested under `.fields` (see inMemoryVersionStore.js) rather than flat
 * columns the way a real Prisma TalentVersion row (and therefore
 * extractTalentVersionFields/talentVersionIsUnchangedFromPublished, both
 * written against the real flat shape) expects. This adapts one to the
 * other for test purposes only — production code never needs this, since
 * the real talentAdapter.getVersion always returns a flat row already.
 */
function toFlatVersion(version) {
  if (!version) return version;
  return { ...version.fields, id: version.id, status: version.status };
}

/**
 * Publishes a brand-new TalentVersion end to end (create -> submit ->
 * approve), the same sequence directPublish.test.js's first test uses, so
 * each test here starts from a talent that already has a real Published
 * version to compare a later Draft against.
 */
async function seedPublishedTalent(adapter, fields = { name: 'Dana Cohen' }) {
  const parent = adapter._seedParent();
  const { version: draft } = await proposalService.create(adapter, {
    parentId: parent.id,
    fields,
    actorId: 'owner-1',
  });
  await proposalService.submit(adapter, { parentId: parent.id, versionId: draft.id, actorId: 'owner-1' });
  const { version: published } = await approvalService.approve(adapter, {
    parentId: parent.id,
    versionId: draft.id,
    actorId: 'owner-1',
    actorRole: ROLE.OWNER,
    basedOnRevisionNumber: 0,
  });
  return { parent, published };
}

/**
 * Mirrors POST /api/admin/talent/[id]/proposals ("Start Editing"): seeds a
 * brand-new DRAFT as a verbatim clone of the Published version's fields.
 */
async function startEditing(adapter, { parentId, publishedVersion, actorId = 'owner-1' }) {
  const { version } = await proposalService.create(adapter, {
    parentId,
    fields: extractTalentVersionFields(toFlatVersion(publishedVersion)),
    actorId,
    basedOnVersionId: publishedVersion.id,
  });
  return version;
}

describe('talentVersionIsUnchangedFromPublished', () => {
  it('is true for a freshly-created draft that mirrors "Start Editing" (never edited since)', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter);
    const draft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });

    expect(talentVersionIsUnchangedFromPublished(toFlatVersion(draft), toFlatVersion(published))).toBe(true);
  });

  it('is false the moment a real field is edited (Save Draft persisted a change)', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter);
    const draft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });

    const edited = await adapter.updateProposedVersion(draft.id, { bioHe: 'ביוגרפיה חדשה' });

    expect(talentVersionIsUnchangedFromPublished(toFlatVersion(edited), toFlatVersion(published))).toBe(false);
  });

  it('treats an array field change (e.g. category) as a real difference', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter, { name: 'Dana', category: ['acting'] });
    const draft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });

    const edited = await adapter.updateProposedVersion(draft.id, { category: ['acting', 'hosting'] });

    expect(talentVersionIsUnchangedFromPublished(toFlatVersion(edited), toFlatVersion(published))).toBe(false);
  });

  it('never treats a missing pending or published version as "unchanged" (unknown must not mean safe)', () => {
    expect(talentVersionIsUnchangedFromPublished(null, { name: 'x' })).toBe(false);
    expect(talentVersionIsUnchangedFromPublished({ name: 'x' }, null)).toBe(false);
    expect(talentVersionIsUnchangedFromPublished(null, null)).toBe(false);
  });
});

describe('Post-Publish Edit Mode Cleanup — the sequence gallery/publish and socials/publish now run', () => {
  it('an untouched DRAFT is discarded, leaving no pending version behind (exits edit mode, clears draft state)', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter);
    const draft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });

    // The exact sequence added to both publish routes.
    const pendingVersion = await versionService.getCurrentDraftOrProposed(adapter, parent.id);
    expect(pendingVersion.id).toBe(draft.id);
    expect(pendingVersion.status).toBe(VERSION_STATUS.DRAFT);

    if (
      pendingVersion &&
      pendingVersion.status === VERSION_STATUS.DRAFT &&
      talentVersionIsUnchangedFromPublished(toFlatVersion(pendingVersion), toFlatVersion(published))
    ) {
      await proposalService.discard(adapter, {
        parentId: parent.id,
        versionId: pendingVersion.id,
        actorId: 'owner-1',
        actorRole: ROLE.OWNER,
      });
    }

    // No pending version anywhere -> globalEditing derives false, and
    // page.jsx's CancelEditingButton (only rendered when a DRAFT exists)
    // has nothing left to attach to, so no discard confirmation can ever
    // be shown for it.
    const after = await versionService.getCurrentDraftOrProposed(adapter, parent.id);
    expect(after).toBeNull();
  });

  it('a DRAFT with real unpublished changes is left completely intact (no data loss from an unrelated Gallery/Socials publish)', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter);
    const draft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });
    await adapter.updateProposedVersion(draft.id, { bioHe: 'עדיין בעבודה' });

    const pendingVersion = await versionService.getCurrentDraftOrProposed(adapter, parent.id);
    const isUnchanged = talentVersionIsUnchangedFromPublished(toFlatVersion(pendingVersion), toFlatVersion(published));
    expect(isUnchanged).toBe(false);

    // Mirrors the route's guard: discard is only ever called when
    // isUnchanged is true — a real draft is never reached by this branch.
    if (pendingVersion.status === VERSION_STATUS.DRAFT && isUnchanged) {
      await proposalService.discard(adapter, {
        parentId: parent.id,
        versionId: pendingVersion.id,
        actorId: 'owner-1',
        actorRole: ROLE.OWNER,
      });
    }

    const after = await versionService.getCurrentDraftOrProposed(adapter, parent.id);
    expect(after).not.toBeNull();
    expect(after.id).toBe(draft.id);
    expect(toFlatVersion(after).bioHe).toBe('עדיין בעבודה');
  });

  it('a PROPOSED pending version is never discarded even if its fields happen to be unchanged (already submitted for review)', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent, published } = await seedPublishedTalent(adapter);
    const draft = await startEditing(adapter, { parentId: parent.id, publishedVersion: published });
    const proposed = await proposalService.submit(adapter, {
      parentId: parent.id,
      versionId: draft.id,
      actorId: 'owner-1',
    });
    expect(proposed.status).toBe(VERSION_STATUS.PROPOSED);

    const pendingVersion = await versionService.getCurrentDraftOrProposed(adapter, parent.id);

    // Mirrors the route's guard exactly: only status === DRAFT is eligible.
    let discarded = false;
    if (
      pendingVersion.status === VERSION_STATUS.DRAFT &&
      talentVersionIsUnchangedFromPublished(toFlatVersion(pendingVersion), toFlatVersion(published))
    ) {
      discarded = true;
    }
    expect(discarded).toBe(false);

    const after = await versionService.getCurrentDraftOrProposed(adapter, parent.id);
    expect(after.id).toBe(proposed.id);
    expect(after.status).toBe(VERSION_STATUS.PROPOSED);
  });

  it('no pending version at all is a no-op — nothing to clean up, nothing thrown', async () => {
    const adapter = createFakeTalentAdapter();
    const { parent } = await seedPublishedTalent(adapter);

    const pendingVersion = await versionService.getCurrentDraftOrProposed(adapter, parent.id);
    expect(pendingVersion).toBeNull();
    // The route's `if (pendingVersion && ...)` guard means nothing further
    // ever runs here — nothing to assert beyond "this doesn't throw."
  });
});
