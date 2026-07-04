/*
 * SiteContent / SEO / LegalPage mappers — skeletons (Phase 1: Foundations).
 *
 * Unlike talentMapper.js, these are left as documented stubs rather than
 * full implementations: data/site.js's shape is a deeply nested object
 * (siteConfig.homepage.voiceHeadline, siteConfig.about.founder.bio[], etc.)
 * built from many SiteContent rows (one per section+key per
 * prisma/schema.prisma), and settling the exact section/key naming
 * scheme is deferred to the "remaining content types" implementation
 * phase (ADMIN_PANEL_PLAN.md Section 9, Phase 7) rather than guessed now.
 *
 * PHASE 1 NOTE: not called anywhere yet; the public site continues to
 * import data/site.js directly.
 */

/**
 * Will assemble a flat list of published SiteContent rows for a given
 * `section` back into the nested shape that section occupies in
 * data/site.js (e.g. section: 'homepage' -> siteConfig.homepage). (Phase 7)
 */
export function mapSiteContentRowsToSiteConfigSection(/* section, rows */) {
  throw new Error(
    '[lib/admin/mappers] mapSiteContentRowsToSiteConfigSection is not ' +
      'implemented yet — see ADMIN_PANEL_PLAN.md Section 9, Phase 7.'
  );
}

/**
 * Will turn a published Seo row into the metadata-fields shape Next.js's
 * generateMetadata() functions already expect (the pattern already used
 * in app/[locale]/page.jsx, app/[locale]/about/page.jsx, etc). (Phase 7)
 */
export function mapSeoToMetadataShape(/* seoRow */) {
  throw new Error(
    '[lib/admin/mappers] mapSeoToMetadataShape is not implemented yet — ' +
      'see ADMIN_PANEL_PLAN.md Section 9, Phase 7.'
  );
}

/**
 * Will turn a published LegalPage row's `sections` JSON back into the
 * array-of-section shape data/site.js's accessibilityPage/privacyPage
 * objects already use. (Phase 7)
 */
export function mapLegalPageToPublicShape(/* legalPageRow */) {
  throw new Error(
    '[lib/admin/mappers] mapLegalPageToPublicShape is not implemented yet ' +
      '— see ADMIN_PANEL_PLAN.md Section 9, Phase 7.'
  );
}
