import { siteConfig } from '@/data/site';

export default function robots() {
  const base = siteConfig.meta.url;

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
