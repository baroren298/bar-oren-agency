/*
 * Cancel Editing / Discard Draft sprint — minimal vitest config, added only
 * so test files can import Next.js route handlers (e.g.
 * app/api/admin/talent/[id]/proposals/[versionId]/discard/route.js) the same
 * way the app itself does, via the "@/*" -> "./*" alias already declared in
 * jsconfig.json (used today by Next.js/the editor, but not previously wired
 * up for vitest since no prior test imported a "@/..." path). This file adds
 * no other behavior — it doesn't touch build/runtime config, only how the
 * test runner resolves module specifiers.
 */
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
