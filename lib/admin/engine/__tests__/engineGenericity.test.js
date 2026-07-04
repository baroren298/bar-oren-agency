/*
 * Sprint 3.8 — static guard for Phase 3 success criterion #7
 * (ADMIN_PANEL_PLAN.md Section 13.17): "The engine (lib/admin/engine/*.js,
 * excluding adapters/) contains no entity-specific branching — no
 * `if (entityType === 'TALENT')` or equivalent anywhere outside an adapter
 * file."
 *
 * This can't be fully proven by runtime behavior alone (a service could
 * happen to behave correctly today and still contain a latent
 * entity-specific branch). This test instead checks the property the
 * guardrail actually cares about (Section 13.18: "no entity-specific
 * branching inside engine services") at the source level: no file directly
 * under lib/admin/engine/ (i.e. excluding the adapters/ and listeners/
 * subfolders) imports a concrete adapter module. If a service ever needed
 * to know "is this Talent," it would have to import talentAdapter (or
 * branch on adapter.entityType against a literal) to do it — so the
 * absence of any concrete-adapter import is a solid, mechanically checkable
 * proxy for the property the architecture requires.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const engineDir = path.resolve(__dirname, '..');

function listTopLevelServiceFiles() {
  return fs
    .readdirSync(engineDir)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => fs.statSync(path.join(engineDir, f)).isFile());
}

describe('Core Content Engine genericity (Section 13.9/13.17 #7/13.18)', () => {
  it('no top-level engine service file imports a concrete adapter (talentAdapter, entityAdapter, etc.)', () => {
    // index.js is the barrel export file (re-exports both adapters for
    // convenience, per its own header comment) — it contains no business
    // logic and is not one of the "services" the guardrail is about, so
    // it's the one documented exception to this check.
    //
    // The regex is anchored to an actual `from '...'`/`require('...')`
    // module specifier, not a bare substring match — several service files
    // (e.g. proposalService.js's header doc-comment) legitimately *mention*
    // "lib/admin/engine/adapters/talentAdapter.js" in prose as an example
    // of where entity-specific behavior lives, without importing it. A
    // substring match would flag that prose as a violation; anchoring to
    // the import/require syntax checks the property we actually care
    // about (a real dependency edge), not which words appear in a comment.
    const offenders = [];
    for (const file of listTopLevelServiceFiles().filter((f) => f !== 'index.js')) {
      const contents = fs.readFileSync(path.join(engineDir, file), 'utf8');
      if (
        /(?:from|require\()\s*['"][^'"]*adapters\/(talentAdapter|entityAdapter|siteContentAdapter|seoAdapter|legalPageAdapter)['"]/.test(
          contents
        )
      ) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no top-level engine service file branches on a literal EntityType string (e.g. "TALENT")', () => {
    const offenders = [];
    for (const file of listTopLevelServiceFiles()) {
      const contents = fs.readFileSync(path.join(engineDir, file), 'utf8');
      // Looks for an actual equality/branch against a quoted ENTITY_TYPE
      // value, e.g. `=== 'TALENT'` or `=== "SITE_CONTENT"` — not just the
      // word appearing in a comment (comments legitimately discuss Talent
      // as an example throughout this codebase's documentation style).
      if (/===\s*['"](TALENT|SITE_CONTENT|SEO|LEGAL_PAGE|COLLABORATIONS|AGENCY_SOCIAL|IMAGE_ASSET)['"]/.test(contents)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every top-level engine service file that takes an adapter only calls methods adapterContract requires', () => {
    // Sanity check that the contract itself stays the single source of
    // truth for "what an adapter can be asked to do" — every service
    // file's adapter.<method>( calls should be a subset of
    // REQUIRED_ADAPTER_METHODS plus the static entityType/capabilities
    // properties, never a one-off entity-specific method invented for one
    // adapter.
    const allowedMemberAccess = new Set([
      'entityType',
      'capabilities',
      'getParent',
      'getVersion',
      'listVersionsForParent',
      'insertProposedVersion',
      'submitVersion',
      'publishVersion',
      'rejectVersion',
      'validate',
      'mapToPublicShape',
      'listParents',
      // Save Draft sprint: an optional capability, not in
      // REQUIRED_ADAPTER_METHODS (see talentAdapter.js's header comment on
      // this method for why) — but proposalService.update() does call it,
      // so it must be allowed here too, or this test would flag a call the
      // architecture has deliberately decided is fine.
      'updateProposedVersion',
      // Social Links / Gallery Sprint 1: same optional-capability pattern as
      // updateProposedVersion above (see talentAdapter.js's header comments
      // on each of these methods) — TalentSocial/TalentGalleryImage are
      // per-row-versioned lists, not the single "current version" the
      // generic engine's REQUIRED_ADAPTER_METHODS contract was built around,
      // so socialsService/galleryService call these directly on whichever
      // adapter they're given rather than going through proposalService.
      // Not required of entityAdapter.js or the test fakes, same as
      // updateProposedVersion isn't.
      'getSocialById',
      'insertDraftSocial',
      'updateSocialFields',
      'submitDraftSocials',
      'approveSocial',
      'rejectSocial',
      'getGalleryImageById',
      'insertDraftGalleryImage',
      'updateGalleryImageFields',
      'submitDraftGalleryImages',
      'approveGalleryImage',
      'rejectGalleryImage',
      // Cancel Editing / Discard Draft sprint: same optional-capability
      // pattern as updateProposedVersion above — proposalService.discard()
      // checks `typeof adapter.discardVersion === 'function'` itself and
      // throws a clear error if it's missing, rather than this being part
      // of REQUIRED_ADAPTER_METHODS. Deliberately NOT added to
      // adapterContract.js's required list: that would force every adapter
      // (entityAdapter, fakeEntityAdapter, siteContentAdapter, seoAdapter,
      // legalPageAdapter — none of which implement it, by this sprint's
      // explicit scope) to suddenly fail assertImplementsAdapterContract()
      // wherever it's already called today, breaking unrelated
      // Collaborations/SEO/etc. flows that have nothing to do with this
      // sprint. Talent is the only entity type with Cancel Editing so far.
      'discardVersion',
    ]);

    const offenders = [];
    for (const file of listTopLevelServiceFiles()) {
      const contents = fs.readFileSync(path.join(engineDir, file), 'utf8');
      const matches = contents.matchAll(/\badapter\.([a-zA-Z]+)/g);
      for (const match of matches) {
        if (!allowedMemberAccess.has(match[1])) {
          offenders.push(`${file}: adapter.${match[1]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
