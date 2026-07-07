import { describe, it, expect } from 'vitest';
import nextConfig from './next.config.mjs';

describe('next.config images', () => {
  it('keeps the existing formats config', () => {
    expect(nextConfig.images.formats).toEqual(['image/avif', 'image/webp']);
  });

  it('allows Vercel Blob public hosts via remotePatterns', () => {
    expect(nextConfig.images.remotePatterns).toContainEqual({
      protocol: 'https',
      hostname: '*.public.blob.vercel-storage.com',
    });
  });
});
