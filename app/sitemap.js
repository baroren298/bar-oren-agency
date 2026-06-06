import { siteConfig } from '@/data/site';
import { talentList } from '@/data/talent';

export default function sitemap() {
  const base = siteConfig.meta.url;
  const now  = new Date();

  const staticPages = [
    { url: base,                       lastModified: now, changeFrequency: 'monthly', priority: 1.0 },
    { url: `${base}/talent`,           lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/about`,            lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/contact`,          lastModified: now, changeFrequency: 'yearly',  priority: 0.6 },
    { url: `${base}/accessibility`,    lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/privacy-policy`,   lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ];

  const talentPages = talentList.map((t) => ({
    url:             `${base}/talent/${t.slug}`,
    lastModified:    now,
    changeFrequency: 'monthly',
    priority:        0.8,
  }));

  return [...staticPages, ...talentPages];
}
