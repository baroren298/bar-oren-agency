/*
 * Phase 1 placeholder helper. Repository methods below are stubs that
 * document the intended API surface (per ADMIN_PANEL_PLAN.md Sections 3,
 * 4, 5, 6) without performing any real database work yet — there is no
 * route or UI calling these in this phase, so a loud, explicit failure is
 * preferable to a silent no-op that could be mistaken for working code.
 */
export function notImplemented(methodName) {
  throw new Error(
    `[lib/admin/repository] ${methodName} is not implemented yet. ` +
      'This is a Phase 1 (Foundations) skeleton — see ADMIN_PANEL_PLAN.md ' +
      'Section 9 for which implementation phase wires this method up.'
  );
}
