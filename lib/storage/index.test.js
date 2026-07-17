/*
 * Storage provider resolver — Production Upload Enablement sprint. Verifies
 * registration and, most importantly for this sprint's safety story, that
 * the DEFAULT is still 'local': production uploads only activate when
 * STORAGE_PROVIDER=vercel-blob is set explicitly.
 *
 * The resolver caches its choice in module state, so every case re-imports
 * a fresh copy via vi.resetModules() + dynamic import.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

async function freshGetStorageProvider() {
  vi.resetModules();
  const mod = await import('./index.js');
  return mod.getStorageProvider;
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getStorageProvider', () => {
  it('defaults to the local provider when STORAGE_PROVIDER is unset', async () => {
    vi.stubEnv('STORAGE_PROVIDER', '');
    const getStorageProvider = await freshGetStorageProvider();

    expect(getStorageProvider().name).toBe('local');
  });

  it('resolves vercel-blob when STORAGE_PROVIDER=vercel-blob', async () => {
    vi.stubEnv('STORAGE_PROVIDER', 'vercel-blob');
    const getStorageProvider = await freshGetStorageProvider();

    const provider = getStorageProvider();
    expect(provider.name).toBe('vercel-blob');
    expect(typeof provider.put).toBe('function');
    expect(typeof provider.delete).toBe('function');
    expect(typeof provider.getSignedUrl).toBe('function');
  });

  it('caches the resolved provider per process', async () => {
    vi.stubEnv('STORAGE_PROVIDER', 'vercel-blob');
    const getStorageProvider = await freshGetStorageProvider();

    expect(getStorageProvider()).toBe(getStorageProvider());
  });

  it('throws for an unknown STORAGE_PROVIDER, naming the known providers', async () => {
    vi.stubEnv('STORAGE_PROVIDER', 'cloudinary');
    const getStorageProvider = await freshGetStorageProvider();

    expect(() => getStorageProvider()).toThrow(/unknown STORAGE_PROVIDER "cloudinary"/);
    expect(() => getStorageProvider()).toThrow(/local/);
    expect(() => getStorageProvider()).toThrow(/vercel-blob/);
  });
});
