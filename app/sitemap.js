import { siteConfig } from '@/data/site';
import { talentList } from '@/data/talent';
import { localizeHref } from '@/lib/i18n';

/*
 * Builds one sitemap entry for a given Hebrew-style path (e.g. '/talent',
 * '/talent/kim-chorilov') across both locales, with hreflang alternates
 * pointing each language version at the other.
 *
 * localizeHref already encodes the site's locale-routing rules (Hebrew
 * unprefixed at "/", English under "/en"), so URLs here stay consistent
 * with the rest of the app and existing production URLs are unaffected —
 * the Hebrew entries are byte-for-byte the same as before this change.
 */
function buildEntry(base, path, { changeFrequency, priority, lastModified }) {
  /* Hebrew homepage keeps its existing no-trailing-slash URL ("base", not
     "base/") to match production exactly — localizeHref('/', 'he') would
     otherwise add a trailing slash here. */
  const heUrl = path === '/' ? base : `${base}${localizeHref(path, 'he')}`;
  const enUrl = `${base}${localizeHref(path, 'en')}`;

  return [
    {
      url: heUrl,
      lastModified,
      changeFrequency,
      priority,
      alternates: {
        languages: { he: heUrl, en: enUrl },
      },
    },
    {
      url: enUrl,
      lastModified,
      changeFrequency,
      priority,
      alternates: {
        languages: { he: heUrl, en: enUrl },
      },
    },
  ];
}

export default function sitemap() {
  const base = siteConfig.meta.url;
  const now  = new Date();

  const staticPaths = [
    { path: '/',                changeFrequency: 'monthly', priority: 1.0 },
    { path: '/talent',          changeFrequency: 'weekly',  priority: 0.9 },
    { path: '/about',           changeFrequency: 'monthly', priority: 0.7 },
    { path: '/contact',         changeFrequency: 'yearly',  priority: 0.6 },
    { path: '/accessibility',   changeFrequency: 'yearly',  priority: 0.3 },
    { path: '/privacy-policy',  changeFrequency: 'yearly',  priority: 0.3 },
  ];

  const staticEntries = staticPaths.flatMap(({ path, changeFrequency, priority }) =>
    buildEntry(base, path, { changeFrequency, priority, lastModified: now })
  );

  const talentEntries = talentList.flatMap((t) =>
    buildEntry(base, `/talent/${t.slug}`, {
      changeFrequency: 'monthly',
      priority: 0.8,
      lastModified: now,
    })
  );

  return [...staticEntries, ...talentEntries];
}
