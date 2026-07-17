import { notFound } from 'next/navigation';
import { siteConfig } from '@/data/site';
import { localizeHref } from '@/lib/i18n';
import ProfileHero from '@/components/talent/ProfileHero';
import ProfileGallery from '@/components/talent/ProfileGallery';
import PodcastSection from '@/components/talent/PodcastSection';
/* ProfileMeta import removed for launch — component kept at
   components/talent/ProfileMeta.jsx for future reuse when
   tag/category filtering is reactivated on the roster page. */
import ProfileCTA from '@/components/talent/ProfileCTA';
import ProfileNav from '@/components/talent/ProfileNav';
import JsonLd from '@/components/ui/JsonLd';
import {
  getPublicTalentList,
  getPublicTalentBySlug,
  getPublicTalentSlugs,
} from '@/lib/public/talent';
import { buildTalentSeoMetadata } from '@/lib/public/seo';

/*
 * Phase 1 of the CMS connection (read-only): this page now reads talent
 * data through lib/public/talent.js, which prefers Postgres's current
 * PUBLISHED talents and falls back to the static data/talent/index.js
 * list whenever the database isn't configured, has no published talent
 * yet, or a read fails. See that file's header comment for the fallback
 * contract. ISR keeps the page from hitting the database on every request
 * while still picking up new Publishes within TALENT_REVALIDATE_SECONDS;
 * `dynamicParams` stays at its default (true) so a slug published after
 * the last build/regeneration still renders on demand instead of 404ing.
 *
 * NOTE: Next.js's route segment config exports (revalidate, dynamic, etc.)
 * must be statically analyzable literals — it rejects an exported
 * reference to an imported variable ("Invalid segment configuration
 * export detected") even though the value is a plain number at runtime.
 * So this is hardcoded to match TALENT_REVALIDATE_SECONDS rather than
 * importing it directly; keep the two in sync if that constant changes.
 */
export const revalidate = 60; // keep in sync with TALENT_REVALIDATE_SECONDS in lib/public/talent.js

/* Pre-render every known talent profile at build time */
export async function generateStaticParams() {
  const slugs = await getPublicTalentSlugs();
  return slugs.map((slug) => ({ slug }));
}

/*
 * TODO(404 architecture, QA/hardening pass): unknown talent slugs (and
 * unmatched paths generally) currently render Next.js's built-in default
 * 404 instead of app/[locale]/not-found.jsx. Root cause: there is no
 * root-level app/not-found.js (or app/layout.js) — only app/[locale]/
 * versions exist — and Next's custom-404 pipeline appears to require a
 * root not-found.js to activate at all; a nested one alone isn't
 * sufficient (notFound() in this page already fires correctly, this was
 * verified directly). Fixing this properly means promoting a thin
 * app/layout.jsx to the true root, demoting app/[locale]/layout.jsx to a
 * normal nested layout, and adding a root app/not-found.jsx. Deferred
 * until then — not blocking the current i18n translation work.
 */

/*
 * Per-profile SEO metadata — Talent SEO + Slug Management sprint: the
 * inline logic moved verbatim into lib/public/seo.js's
 * buildTalentSeoMetadata (pure, unit-tested), now extended to prefer the
 * talent's PUBLISHED seo* fields with the previous behavior as the smart
 * default for every empty field. Only published data ever reaches this
 * page (getPublicTalentBySlug reads currentPublishedVersion only), so
 * drafts/proposals can never change public metadata before Publish.
 */
export async function generateMetadata({ params }) {
  const { slug, locale } = await params;
  const talent = await getPublicTalentBySlug(slug);
  if (!talent) return {};

  return buildTalentSeoMetadata({
    talent,
    locale,
    canonicalPath: localizeHref(`/talent/${slug}`, locale),
  });
}

/* Person + BreadcrumbList structured data */
function buildProfileSchemas(talent, locale = 'he') {
  const isEnglish = locale === 'en';
  const BASE = siteConfig.meta.url;
  const pageUrl = `${BASE}${localizeHref(`/talent/${talent.slug}`, locale)}`;

  const categoryLabels = siteConfig.categories
    .filter((c) => talent.category.includes(c.key) && c.key !== 'all')
    .map((c) => (isEnglish ? c.labelEn : c.label));

  const personName = isEnglish ? (talent.nameEn || talent.name) : talent.name;

  const person = {
    '@context': 'https://schema.org',
    '@type':    'Person',
    '@id':       pageUrl,
    name:        personName,
    description: isEnglish ? (talent.bioEn || talent.bioHe) : (talent.bioHe || talent.bioEn),
    jobTitle:    categoryLabels.join(', '),
    image:       talent.profileImage ? `${BASE}${talent.profileImage}` : undefined,
    url:         pageUrl,
    worksFor: {
      '@type': 'Organization',
      '@id':   `${BASE}/#organization`,
      name:     siteConfig.agencyName,
      url:      BASE,
    },
    sameAs: [
      talent.instagram,
      talent.tiktok,
      talent.youtube,
    ].filter(Boolean),
  };

  const breadcrumb = {
    '@context':        'https://schema.org',
    '@type':           'BreadcrumbList',
    itemListElement: [
      {
        '@type':  'ListItem',
        position:  1,
        name:      isEnglish ? 'Home' : 'דף הבית',
        item:      `${BASE}${localizeHref('/', locale)}`,
      },
      {
        '@type':  'ListItem',
        position:  2,
        name:      isEnglish ? 'Talent' : 'מיוצגים',
        item:     `${BASE}${localizeHref('/talent', locale)}`,
      },
      {
        '@type':  'ListItem',
        position:  3,
        name:      personName,
        item:      pageUrl,
      },
    ],
  };

  return [person, breadcrumb];
}

export default async function TalentProfilePage({ params }) {
  const { locale, slug } = await params;
  const talent = await getPublicTalentBySlug(slug);

  if (!talent) notFound();

  /* Adjacent talent for prev/next navigation — getPublicTalentList() is
     already sorted by sortOrder and resolved from the same DB-or-static
     source as the lookup above (see lib/public/talent.js), so this never
     mixes a DB-sourced talent's neighbors with static-file entries. */
  const sorted = await getPublicTalentList();
  const idx    = sorted.findIndex((t) => t.slug === slug);
  const prev   = idx > 0 ? sorted[idx - 1] : null;
  const next   = idx < sorted.length - 1 ? sorted[idx + 1] : null;

  return (
    <>
      <ProfileHero    talent={talent} locale={locale} />
      <ProfileGallery talent={talent} locale={locale} />
      {/* Podcast section is data-driven: it renders only when talent.podcast
          exists (currently only on Michal Ben David's profile), so it has
          no effect on any other talent page. */}
      <PodcastSection talent={talent} locale={locale} />
      {/* ProfileMeta hidden for launch — tags/categories kept in data/talent
          for future filtering; removed from profile UI until roster filters
          are reactivated. */}
      <ProfileCTA     talent={talent} locale={locale} />
      <ProfileNav     prev={prev} next={next} locale={locale} />
      <JsonLd data={buildProfileSchemas(talent, locale)} />
    </>
  );
}
