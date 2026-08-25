/*
 * TalentDetailsEditor.buildSaveFields — Talent Details Lifecycle
 * Unification sprint.
 *
 * Locks the exact flattening contract handleSaveDraft's single PATCH now
 * relies on: ComparisonView's `values.profileImage` (the Profile Image
 * field's live proposed value, in ImageEditorCard's own
 * { assetUrl, assetId?, position, scale } onChange shape) becomes three
 * real TalentVersion columns, with the null-vs-absent semantics
 * talentRepository.updateTalentVersionFields' sparse allowlisted update
 * depends on preserved exactly. Pure function, no fetch/router/DOM — no
 * mocking needed, same reasoning as testing buildDetailsGroups directly.
 */
import { describe, it, expect } from 'vitest';
import { buildSaveFields } from '@/components/admin/TalentDetailsEditor';

describe('buildSaveFields', () => {
  it('flattens profileImage into the three real columns alongside ordinary Details fields, in one payload', () => {
    const fields = buildSaveFields({
      name: 'ליהי לוי',
      nameEn: 'Lihi Levi',
      bioHe: 'ביו',
      profileImage: { assetUrl: 'https://blob.test/a.jpg', assetId: 'asset-1', position: '10% 20%', scale: 1.5 },
    });

    expect(fields).toEqual({
      name: 'ליהי לוי',
      nameEn: 'Lihi Levi',
      bioHe: 'ביו',
      profileImagePosition: '10% 20%',
      profileImageScale: 1.5,
      profileImageAssetId: 'asset-1',
    });
  });

  it('never sends assetUrl — it is a client-side display concern only', () => {
    const fields = buildSaveFields({
      profileImage: { assetUrl: 'https://blob.test/a.jpg', assetId: 'asset-1', position: null, scale: null },
    });

    expect(fields).not.toHaveProperty('assetUrl');
  });

  it('maps a changed assetId to profileImageAssetId', () => {
    const fields = buildSaveFields({
      profileImage: { assetUrl: 'https://blob.test/b.jpg', assetId: 'asset-9', position: 'center top', scale: 1 },
    });

    expect(fields.profileImageAssetId).toBe('asset-9');
  });

  it('omits profileImageAssetId entirely when the asset did not change this session (no assetId on the value)', () => {
    // The shape buildInitialValues seeds from the published/draft version:
    // no `assetId` key at all, since the client never needs to know the
    // already-persisted asset's id.
    const fields = buildSaveFields({
      profileImage: { assetUrl: 'https://blob.test/existing.jpg', position: 'center center', scale: 1 },
    });

    expect(fields).not.toHaveProperty('profileImageAssetId');
    expect(fields.profileImagePosition).toBe('center center');
    expect(fields.profileImageScale).toBe(1);
  });

  it('sends profileImagePosition as an explicit null when reset to default — not omitted', () => {
    const fields = buildSaveFields({
      profileImage: { assetUrl: 'https://blob.test/a.jpg', position: null, scale: 1 },
    });

    expect(fields).toHaveProperty('profileImagePosition', null);
  });

  it('sends profileImageScale as an explicit null when reset to default — not omitted', () => {
    const fields = buildSaveFields({
      profileImage: { assetUrl: 'https://blob.test/a.jpg', position: 'center center', scale: null },
    });

    expect(fields).toHaveProperty('profileImageScale', null);
  });

  it('leaves ordinary Details fields untouched when there is no profileImage key at all', () => {
    const fields = buildSaveFields({ name: 'שם', bioHe: 'ביו' });

    expect(fields).toEqual({ name: 'שם', bioHe: 'ביו' });
    expect(fields).not.toHaveProperty('profileImagePosition');
    expect(fields).not.toHaveProperty('profileImageScale');
    expect(fields).not.toHaveProperty('profileImageAssetId');
  });
});
