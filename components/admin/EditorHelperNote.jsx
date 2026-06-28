/*
 * EditorHelperNote — Profile Editor Foundation sprint, retired by the
 * "Remove Shared Helper Note" polish sprint.
 *
 * Used to render a small, calm note above the action bar in every editor
 * built on ComparisonView (Details, Podcast) plus SeoEditor and
 * SocialLinksEditor: "this is a proposed update, nothing publishes until
 * the owner approves it, you can save a draft and continue later."
 *
 * Removed per explicit instruction, everywhere it appeared, without a
 * replacement message. Left as a no-op (rather than deleted, or removed
 * from each of its ~3 call sites individually) so every existing
 * `import EditorHelperNote from "./EditorHelperNote"` / `<EditorHelperNote />`
 * in ComparisonView.jsx / SeoEditor.jsx / SocialLinksEditor.jsx keeps
 * resolving and rendering exactly nothing — one edit, every consumer
 * inherits it, zero risk of missing a call site. Rendering `null` means no
 * DOM node is produced, so the flex-column `gap` those callers already use
 * between their fields and <EditorActionBar> simply doesn't apply to a
 * nonexistent child — no extra empty space is left behind, and no other
 * spacing/layout change was needed.
 *
 * he.editor.helperNote (lib/admin/i18n/he.js) is intentionally left in
 * place, unused — copy data, not logic; removing it isn't necessary to
 * remove the message and risks nothing by staying.
 */

export default function EditorHelperNote() {
  return null;
}
