/*
 * Talent SEO + Slug Management sprint — smart defaults + empty-SEO
 * fallback for the public page metadata (lib/public/seo.js). The invariant
 * that matters most: a talent with NO published SEO values produces
 * byte-for-byte the same metadata the page generated before this sprint,
 * so shipping SEO management changes nothing publicly until someone
 * actually publishes SEO values.
 */
import { describe, it, expect } from 'vitest';
import { buildTalentSeoMetadata } from '@/lib/public/seo';

const BASE_TALENT = {
  slug: 'noa-kirel',
  name: 'נועה קירל',
  nameEn: 'Noa Kirel',
  bioHe: 'ביוגרפיה בעברית',
  bioEn: 'English bio',
  profileImage: 'https://blob.test/profile.jpg',
};

describe('buildTalentSeoMetadata — empty SEO fallback (smart defaults)', () => {
  it('falls back to name / bio / profile image / current URL when no seo object exists', () => {
    const metadata = buildTalentSeoMetadata({
      talent: BASE_TALENT,
      locale: 'he',
      canonicalPath: '/talent/noa-kirel',
    });

    expect(metadata.title).toBe('נועה קירל');
    expect(metadata.description).toBe('ביוגרפיה בעברית');
    expect(metadata.alternates.canonical).toBe('/talent/noa-kirel');
    expect(metadata.openGraph.title).toBe('נועה קירל | Bar Oren');
    expect(metadata.openGraph.description).toBe('ביוגרפיה בעברית');
    expect(metadata.openGraph.images[0]).toEqual({
      url: 'https://blob.test/profile.jpg',
      alt: 'נועה קירל',
    });
    // indexable by default — no robots directive at all
    expect(metadata.robots).toBeUndefined();
  });

  it('treats an all-empty seo object identically to no seo object', () => {
    const withEmpty = buildTalentSeoMetadata({
      talent: { ...BASE_TALENT, seo: { title: null, description: '', ogTitle: '  ', noindex: false } },
      locale: 'he',
      canonicalPath: '/talent/noa-kirel',
    });
    const without = buildTalentSeoMetadata({
      talent: BASE_TALENT,
      locale: 'he',
      canonicalPath: '/talent/noa-kirel',
    });
    expect(withEmpty).toEqual(without);
  });

  it('falls back to the branded OG image when there is no profile image either', () => {
    const metadata = buildTalentSeoMetadata({
      talent: { ...BASE_TALENT, profileImage: null },
      locale: 'he',
      canonicalPath: '/talent/noa-kirel',
    });
    expect(metadata.openGraph.images[0]).toEqual({
      url: '/og-image.jpg',
      width: 1200,
      height: 630,
      alt: 'נועה קירל',
    });
  });

  it('uses English name/bio for the en locale, with Hebrew fallback', () => {
    const metadata = buildTalentSeoMetadata({
      talent: BASE_TALENT,
      locale: 'en',
      canonicalPath: '/en/talent/noa-kirel',
    });
    expect(metadata.title).toBe('Noa Kirel');
    expect(metadata.description).toBe('English bio');
  });
});

describe('buildTalentSeoMetadata — published SEO values win', () => {
  const SEO = {
    title: 'Custom SEO Title',
    description: 'Custom meta description',
    canonicalUrl: 'https://baroren.co.il/talent/custom-canonical',
    ogTitle: 'Custom OG Title',
    ogDescription: 'Custom OG description',
    ogImageUrl: 'https://cdn.test/custom-og.jpg',
    noindex: false,
  };

  it('prefers every published SEO value over its smart default', () => {
    const metadata = buildTalentSeoMetadata({
      talent: { ...BASE_TALENT, seo: SEO },
      locale: 'he',
      canonicalPath: '/talent/noa-kirel',
    });

    expect(metadata.title).toBe('Custom SEO Title');
    expect(metadata.description).toBe('Custom meta description');
    expect(metadata.alternates.canonical).toBe('https://baroren.co.il/talent/custom-canonical');
    expect(metadata.openGraph.title).toBe('Custom OG Title');
    expect(metadata.openGraph.description).toBe('Custom OG description');
    expect(metadata.openGraph.images[0]).toEqual({
      url: 'https://cdn.test/custom-og.jpg',
      alt: 'Custom OG Title',
    });
  });

  it('mixes per-field: a set title with an empty description falls back only for the description', () => {
    const metadata = buildTalentSeoMetadata({
      talent: { ...BASE_TALENT, seo: { title: 'Only Title Set' } },
      locale: 'he',
      canonicalPath: '/talent/noa-kirel',
    });
    expect(metadata.title).toBe('Only Title Set');
    expect(metadata.description).toBe('ביוגרפיה בעברית');
  });

  it('published noindex emits a robots noindex directive', () => {
    const metadata = buildTalentSeoMetadata({
      talent: { ...BASE_TALENT, seo: { noindex: true } },
      locale: 'he',
      canonicalPath: '/talent/noa-kirel',
    });
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('returns {} for a missing talent', () => {
    expect(buildTalentSeoMetadata({ talent: null, locale: 'he', canonicalPath: '/x' })).toEqual({});
  });
});
