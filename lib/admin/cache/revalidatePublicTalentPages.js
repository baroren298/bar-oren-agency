/*
 * revalidatePublicTalentPages — best-effort ISR cache invalidation for the
 * public talent pages, called by publishService.publish() right after a
 * TalentVersion is published (see lib/admin/engine/publishService.js).
 *
 * Why this is its own module rather than calling `revalidatePath` directly
 * from publishService.js:
 *   1. `next/cache`'s `revalidatePath` requires a live Next.js request /
 *      static-generation context. Vitest has none, so importing `next/cache`
 *      directly inside publishService.js makes every test that exercises
 *      publish() (approvalAndPublish.test.js, directPublish.test.js,
 *      auditLogProjection.test.js) fail outside Next's runtime. Isolating
 *      the call here lets those tests mock this one small module instead of
 *      stubbing Next internals.
 *   2. publishService.js is documented as generic/entity-agnostic (Section
 *      13.9/13.16 — "no entity-specific branching"); naming the public
 *      talent routes explicitly belongs in a small, named helper, not
 *      inline in the lifecycle engine.
 *
 * Errors are caught and logged here, never thrown — matching the existing
 * best-effort pattern eventService.runListeners() already uses for
 * post-write side effects (see that file's header comment: "a publish
 * should not roll back because an audit listener threw"). A failed cache
 * invalidation must not undo, or appear to undo, a publish that already
 * committed; the public pages will still self-heal via their own
 * time-based `revalidate = 60` window even if this best-effort call fails.
 */
import { revalidatePath } from 'next/cache';

/**
 * Invalidate the public talent roster and profile pages so a publish is
 * visible immediately instead of waiting on their ISR `revalidate` window.
 */
export function revalidatePublicTalentPages() {
  try {
    revalidatePath('/[locale]/talent', 'page');
    revalidatePath('/[locale]/talent/[slug]', 'page');
  } catch (err) {
    console.error(
      '[revalidatePublicTalentPages] failed to revalidate public talent pages:',
      err
    );
  }
}

export default revalidatePublicTalentPages;
