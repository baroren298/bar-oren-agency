/*
 * Global Edit Mode UX sprint — unit tests for the shared edit-activation
 * derivation (lib/admin/edit-mode.js). These pure functions are the single
 * rule the page and the Gallery/Socials/SEO editors all use, so covering
 * every status/flag combination here covers the derivation logic behind
 * each tab's behavior. Rendering-level coverage (CTA removed, surfaces
 * open, Save/Publish untouched) lives in
 * components/admin/__tests__/globalEditMode.test.jsx.
 */

import { describe, it, expect } from 'vitest';
import {
  isGlobalEditingStatus,
  deriveEffectiveEditing,
  deriveInitialLocalEditing,
} from '@/lib/admin/edit-mode';
import { VERSION_STATUS } from '@/lib/admin/constants/enums';

describe('isGlobalEditingStatus', () => {
  it('is false when no pending version exists (no global draft)', () => {
    expect(isGlobalEditingStatus(null)).toBe(false);
    expect(isGlobalEditingStatus(undefined)).toBe(false);
  });

  it('is true for a DRAFT pending version (page is editing)', () => {
    expect(isGlobalEditingStatus(VERSION_STATUS.DRAFT)).toBe(true);
  });

  it('is true for a PROPOSED pending version (still an active editing flow)', () => {
    expect(isGlobalEditingStatus(VERSION_STATUS.PROPOSED)).toBe(true);
  });

  it('is false for statuses that are not an active editing flow', () => {
    expect(isGlobalEditingStatus(VERSION_STATUS.PUBLISHED)).toBe(false);
    expect(isGlobalEditingStatus(VERSION_STATUS.REJECTED)).toBe(false);
    expect(isGlobalEditingStatus('SOMETHING_ELSE')).toBe(false);
  });
});

describe('deriveEffectiveEditing', () => {
  it('no global draft + no local activation → not editing (current behavior unchanged)', () => {
    expect(deriveEffectiveEditing({ globalEditing: false, localEditing: false })).toBe(false);
    expect(deriveEffectiveEditing({})).toBe(false);
    expect(deriveEffectiveEditing()).toBe(false);
  });

  it('global editing active → editable immediately, regardless of local state', () => {
    expect(deriveEffectiveEditing({ globalEditing: true, localEditing: false })).toBe(true);
    expect(deriveEffectiveEditing({ globalEditing: true, localEditing: true })).toBe(true);
  });

  it('no global draft + intentional local activation → editable (unchanged local flow)', () => {
    expect(deriveEffectiveEditing({ globalEditing: false, localEditing: true })).toBe(true);
  });

  it('global editing ending falls back to the local flag — a module draft session survives, an untouched tab returns to read-only', () => {
    // Tab whose own module draft seeded localEditing=true: stays editing.
    expect(deriveEffectiveEditing({ globalEditing: false, localEditing: true })).toBe(true);
    // Tab with nothing of its own: returns to the read-only view.
    expect(deriveEffectiveEditing({ globalEditing: false, localEditing: false })).toBe(false);
  });

  it('coerces truthy/falsy inputs to a strict boolean', () => {
    expect(deriveEffectiveEditing({ globalEditing: undefined, localEditing: undefined })).toBe(false);
    expect(deriveEffectiveEditing({ globalEditing: 1, localEditing: 0 })).toBe(true);
  });
});

describe('deriveInitialLocalEditing', () => {
  it('true when module-specific draft rows already exist (resume in-progress session)', () => {
    expect(deriveInitialLocalEditing([{ id: 'row-1' }])).toBe(true);
  });

  it('false when the module has no draft rows of its own', () => {
    expect(deriveInitialLocalEditing([])).toBe(false);
    expect(deriveInitialLocalEditing(null)).toBe(false);
    expect(deriveInitialLocalEditing(undefined)).toBe(false);
  });
});
