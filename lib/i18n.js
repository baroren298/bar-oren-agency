import { strings } from '@/data/i18n/strings';

export const SUPPORTED_LOCALES = ['he', 'en'];
export const DEFAULT_LOCALE = 'he';

/*
 * Hebrew is served unprefixed at "/" (via the next.config.mjs rewrites),
 * English lives under "/en". Components that need locale awareness (e.g.
 * Header, Footer — both render once per locale tree but are plain client
 * components with no params of their own) derive locale from the current
 * pathname, the same approach already used in app/[locale]/not-found.jsx.
 */
export function getLocaleFromPathname(pathname = '') {
  return pathname.startsWith('/en') ? 'en' : 'he';
}

export function getStrings(locale) {
  return strings[locale] || strings[DEFAULT_LOCALE];
}

export function homeHref(locale) {
  return locale === 'he' ? '/' : '/en';
}

/* Turns a Hebrew-style href (e.g. "/about") into the equivalent href for
   the given locale. Hebrew hrefs pass through unchanged. */
export function localizeHref(href, locale) {
  if (locale === 'he') return href;
  if (href === '/') return '/en';
  return `/en${href}`;
}

/* Given the current pathname, returns the equivalent path in the other
   supported locale — used by the language switcher to preserve the
   current page when toggling languages. */
export function getAlternatePath(pathname = '/') {
  const isEn = pathname.startsWith('/en');
  const rest = isEn ? pathname.slice(3) : pathname;
  const cleanRest = rest === '' ? '/' : rest;

  if (isEn) {
    return cleanRest; // -> Hebrew path
  }
  return cleanRest === '/' ? '/en' : `/en${cleanRest}`; // -> English path
}
