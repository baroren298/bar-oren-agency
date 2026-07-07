/*
 * Test-only stand-in for '@vercel/blob' — Production Upload Enablement
 * sprint. vitest.config.js aliases the package here so no test can ever
 * touch the real SDK (and therefore the network), even if a mock is
 * forgotten. Every function throws on purpose: a test that reaches one of
 * these has a missing vi.mock, and the loud failure points straight at it.
 * Never imported by application code.
 */

function refuse(name) {
  throw new Error(
    `[vercelBlobSdkStub] '${name}' was called without being mocked — tests must ` +
      `vi.mock('@vercel/blob', ...) and never hit the real SDK/network.`
  );
}

export function put() {
  refuse('put');
}

export function del() {
  refuse('del');
}

export function head() {
  refuse('head');
}

export function list() {
  refuse('list');
}
