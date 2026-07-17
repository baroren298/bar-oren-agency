/*
 * Cancel Editing / Discard Draft sprint — minimal vitest config, added only
 * so test files can import Next.js route handlers (e.g.
 * app/api/admin/talent/[id]/proposals/[versionId]/discard/route.js) the same
 * way the app itself does, via the "@/*" -> "./*" alias already declared in
 * jsconfig.json (used today by Next.js/the editor, but not previously wired
 * up for vitest since no prior test imported a "@/..." path). This file adds
 * no other behavior — it doesn't touch build/runtime config, only how the
 * test runner resolves module specifiers.
 *
 * Production Upload Enablement sprint: '@vercel/blob' is aliased to a local
 * stub (lib/storage/providers/__tests__/vercelBlobSdkStub.js) FOR TESTS
 * ONLY. Two reasons: (1) the sprint's hard rule that no test may ever make
 * a network call — even an accidentally un-mocked import of the real SDK
 * can't reach Vercel this way; (2) tests stay runnable in environments
 * where the package isn't installed yet. Provider tests still vi.mock the
 * module; this alias is the safety net underneath, not the mock itself.
 * The real @vercel/blob (package.json dependency) is untouched at
 * build/runtime — Next.js never reads this file.
 *
 * Global Edit Mode UX sprint: `esbuild.jsx: 'automatic'` aligns the test
 * runner's JSX transform with the one Next.js itself uses. Next compiles
 * every component with React 17+'s automatic runtime (JSX becomes imports
 * from 'react/jsx-runtime'; no `import React` needed and none of our
 * components have one). Vite/esbuild's DEFAULT, however, is the classic
 * transform — JSX becomes `React.createElement(...)` — so the first test
 * that rendered real components (components/admin/__tests__/
 * globalEditMode.test.jsx, via react-dom/server) hit "ReferenceError:
 * React is not defined" inside MediaGalleryEditor/SocialLinksEditor/
 * SeoEditor: not a bug in those components, just two toolchains disagreeing
 * about what JSX compiles to. Fixing it here (tests-only, Next never reads
 * this file) keeps app source untouched — adding `import React` to
 * components would have papered over the mismatch instead of removing it.
 */
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@vercel/blob': path.resolve(
        __dirname,
        'lib/storage/providers/__tests__/vercelBlobSdkStub.js'
      ),
      '@': path.resolve(__dirname, '.'),
    },
  },
});
