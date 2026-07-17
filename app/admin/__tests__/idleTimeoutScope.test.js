/*
 * Idle-timeout scope + manual-logout regression tests — Sprint 4 (Admin Idle
 * Timeout & Automatic Logout).
 *
 * AdminShell.jsx is an async Server Component that calls next/headers'
 * cookies() — it can't be rendered standalone in this repo's plain vitest
 * setup (no request context, no jsdom). Instead these are structural
 * source-text checks, same spirit as this repo's other "assert the wiring
 * is where it should be" tests: they read the actual files with node:fs and
 * assert the idle manager is referenced exactly where policy requires
 * (mounted in the authenticated shell) and nowhere on the public login
 * surface, and that the existing manual-logout button is untouched.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..', '..');

function read(relativePath) {
  return readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('idle timeout — mounted only inside the authenticated Admin shell', () => {
  it('AdminShell.jsx imports and renders AdminIdleTimeoutManager', () => {
    const source = read('app/admin/AdminShell.jsx');
    expect(source).toMatch(/import AdminIdleTimeoutManager from/);
    expect(source).toMatch(/<AdminIdleTimeoutManager\s*\/>/);
  });

  it('the login page does not reference AdminIdleTimeoutManager', () => {
    const source = read('app/admin/login/page.jsx');
    expect(source).not.toMatch(/AdminIdleTimeoutManager/);
  });

  it('LoginForm does not reference AdminIdleTimeoutManager', () => {
    const source = read('app/admin/login/LoginForm.jsx');
    expect(source).not.toMatch(/AdminIdleTimeoutManager/);
  });

  it('the login page does not render <AdminShell> (the only place the idle manager is mounted)', () => {
    const source = read('app/admin/login/page.jsx');
    expect(source).not.toMatch(/AdminShell/);
  });
});

describe('idle timeout — existing manual logout is unchanged', () => {
  it('AdminLogoutButton still POSTs to the existing logout endpoint and redirects to /admin/login', () => {
    const source = read('app/admin/AdminLogoutButton.jsx');
    expect(source).toMatch(/fetch\(\s*["']\/api\/admin\/auth\/logout["']\s*,\s*\{\s*method:\s*["']POST["']/);
    expect(source).toMatch(/router\.push\(\s*["']\/admin\/login["']\s*\)/);
    // Sprint 4 must not have added idle-timeout wiring into the manual button.
    expect(source).not.toMatch(/idleTimeout|AdminIdleTimeoutManager/);
  });

  it('the logout route itself is untouched by this sprint (idempotent revoke-then-clear-cookie shape still present)', () => {
    const source = read('app/api/admin/auth/logout/route.js');
    expect(source).toMatch(/sessionService\.revokeSession/);
    expect(source).toMatch(/response\.cookies\.set\(SESSION_COOKIE_NAME/);
  });
});
