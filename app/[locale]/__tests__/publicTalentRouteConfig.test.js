/*
 * Public talent profile route — `dynamicParams` route-chain guard.
 *
 * Regression coverage for the production bug where a talent created and
 * published through the CMS after a deployment returned the site 404 on
 * /talent/<slug> (and /en/talent/<slug>) even though the CMS card showed
 * "פורסם", the talent appeared on /talent and /en/talent, and every public
 * data predicate in lib/public/talent.js passed.
 *
 * Cause: `app/[locale]/layout.jsx` exported `dynamicParams = false`. That
 * flag is NOT scoped to the segment that declares it — Next resolves it
 * once for the entire route chain:
 *
 *   node_modules/next/dist/build/static-paths/app.js
 *   const dynamicParams = segments.every((s) => s.config?.dynamicParams !== false)
 *   const fallbackMode  = dynamicParams ? ... : FallbackMode.NOT_FOUND
 *
 * so one `false` anywhere on the chain put /[locale]/talent/[slug] into
 * fallback mode NOT_FOUND: only slugs returned by generateStaticParams at
 * BUILD time existed, the page component never ran for anything else, and
 * on-demand revalidation could not help (app-page.js only upgrades an
 * on-demand revalidate to a blocking render when the fallback mode is not
 * NOT_FOUND or a cache entry already exists — neither is true for a path
 * that was never prerendered).
 *
 * This is a deliberately narrow source/config-level assertion rather than
 * an import of the layout: importing app/[locale]/layout.jsx pulls in
 * next/font/google and the whole component tree, which would mean broad
 * framework mocking for a check about a one-line route segment config.
 * The invariant being protected is textual by nature — "no segment on this
 * chain exports dynamicParams = false" — so reading the segment sources is
 * the honest test, not a workaround.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

/*
 * Every segment file Next.js composes into /[locale]/talent/[slug],
 * root-most first. If a layout is ever added between them (e.g.
 * app/[locale]/talent/layout.jsx), add it here too — the `existsSync`
 * assertion below is what stops this list from silently going stale.
 */
const ROUTE_CHAIN_SEGMENT_FILES = [
  'app/[locale]/layout.jsx',
  'app/[locale]/talent/[slug]/page.jsx',
];

const LOCALE_LAYOUT = 'app/[locale]/layout.jsx';
const TALENT_PROFILE_PAGE = 'app/[locale]/talent/[slug]/page.jsx';

/*
 * Matches a real route segment config export only. Both files discuss
 * `dynamicParams = false` in their header comments, so the block-comment
 * strip below plus the line-anchored `export const` prefix keep prose from
 * tripping this.
 */
const DYNAMIC_PARAMS_FALSE_EXPORT =
  /^[ \t]*export[ \t]+const[ \t]+dynamicParams[ \t]*=[ \t]*false\b/m;

const FORCE_DYNAMIC_EXPORT =
  /^[ \t]*export[ \t]+const[ \t]+dynamic[ \t]*=[ \t]*['"]force-dynamic['"]/m;

const REVALIDATE_EXPORT = /^[ \t]*export[ \t]+const[ \t]+revalidate[ \t]*=[ \t]*\d+/m;

function readSegmentSource(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);
  /* Also guards against a wrong cwd or a moved file turning every
     assertion below into a vacuous pass. */
  expect(
    fs.existsSync(absolutePath),
    `${relativePath} not found — the public talent route chain moved; update ROUTE_CHAIN_SEGMENT_FILES.`
  ).toBe(true);
  return fs.readFileSync(absolutePath, 'utf8');
}

/* Comments in these files quote the very config string under test. */
function withoutBlockComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('/[locale]/talent/[slug] route segment config', () => {
  it('has no segment that disables dynamicParams for the whole chain', () => {
    for (const relativePath of ROUTE_CHAIN_SEGMENT_FILES) {
      const source = withoutBlockComments(readSegmentSource(relativePath));

      expect(
        DYNAMIC_PARAMS_FALSE_EXPORT.test(source),
        `${relativePath} exports "dynamicParams = false". Next.js applies that ` +
          'flag to the entire route chain, not just this segment, so it forces ' +
          '/[locale]/talent/[slug] into fallback mode NOT_FOUND — a talent ' +
          'published from the CMS after a deployment would 404 publicly until ' +
          'the next deploy. Restrict the locale param at runtime instead (see ' +
          `${LOCALE_LAYOUT}).`
      ).toBe(false);
    }
  });

  it('still restricts [locale] to the pre-rendered locales at runtime', () => {
    const source = readSegmentSource(LOCALE_LAYOUT);

    /* The locale allowlist must not be the thing that got dropped when
       `dynamicParams = false` was removed — unsupported locales still have
       to fail closed. */
    expect(source).toMatch(/SUPPORTED_LOCALES\b/);
    expect(source).toMatch(/from\s+['"]@\/lib\/i18n['"]/);
    expect(source).toMatch(/SUPPORTED_LOCALES\.includes\(locale\)/);
    expect(source).toMatch(/notFound\(\)/);
    expect(source).toMatch(/from\s+['"]next\/navigation['"]/);
  });

  it('keeps talent profile pages static/ISR rather than permanently dynamic', () => {
    const source = withoutBlockComments(readSegmentSource(TALENT_PROFILE_PAGE));

    /* `dynamic = 'force-dynamic'` would also bypass the NOT_FOUND fallback
       (staticPathKey is only set for SSG routes) but at the cost of hitting
       Postgres on every request. It is explicitly not the chosen fix. */
    expect(FORCE_DYNAMIC_EXPORT.test(source)).toBe(false);
    expect(REVALIDATE_EXPORT.test(source)).toBe(true);
  });
});
