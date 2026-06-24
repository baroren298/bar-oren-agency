/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  /*
   * Locale routing — Hebrew stays unprefixed at "/", English lives at "/en".
   *
   * Internally every route is implemented once under app/[locale]/, so these
   * rewrites map the public Hebrew URLs (no prefix) to the internal "/he/..."
   * segment. "/en" and "/en/*" need no rewrite — they already match the
   * app/[locale]/ folder structure directly.
   *
   * IMPORTANT: this list must stay in sync with the routes that exist under
   * app/[locale]/. Add a new line here whenever a new top-level Hebrew route
   * is added.
   */
  async rewrites() {
    return [
      { source: '/', destination: '/he' },
      { source: '/talent', destination: '/he/talent' },
      { source: '/talent/:slug', destination: '/he/talent/:slug' },
      { source: '/about', destination: '/he/about' },
      { source: '/contact', destination: '/he/contact' },
      { source: '/accessibility', destination: '/he/accessibility' },
      { source: '/privacy-policy', destination: '/he/privacy-policy' },
    ];
  },
};

export default nextConfig;
