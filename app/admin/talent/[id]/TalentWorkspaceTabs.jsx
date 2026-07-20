"use client";

/*
 * TalentWorkspaceTabs — Talent Workspace Foundation sprint.
 *
 * The talent workspace's section navigation (sprint requirement #2):
 * פרטים / גלריה / רשתות / SEO / היסטוריה. Client component because it needs
 * to know which tab is active — the section *content* itself is still
 * rendered server-side by ../[id]/page.jsx (a Server Component) and simply
 * passed in as `sections[i].content`, the same pattern AdminShell already
 * uses for its children.
 *
 * Active-tab persistence sprint — the active tab used to live only in
 * `useState`, seeded once from `sections[0]`. That reset to פרטים on every
 * full page load: a plain refresh (or a publish/save action's
 * `router.refresh()`) always dropped the user back to the first tab, and
 * Back/Forward had no per-tab history to restore at all, since nothing
 * about the tab selection ever touched the URL.
 *
 * Fix: the active tab is now derived from the `?tab=` search param instead
 * of local component state — `useSearchParams()` already re-renders this
 * component on every URL change (including browser Back/Forward, which
 * Next.js's client router intercepts for same-origin history entries), so
 * there is no separate state to keep in sync. Clicking a tab pushes a new
 * `?tab=` value via `router.push` (a shallow, same-route navigation — nothing
 * here re-fetches `sections` from the server), which both updates the URL
 * for a future refresh to read back and adds a history entry for Back/
 * Forward to step through. A missing or unrecognized `tab` value (first
 * visit, a stale/hand-edited link, a tab that no longer exists) falls back
 * to `sections[0]` (פרטים) exactly like the previous default did.
 *
 * Still deliberately dumb about anything beyond that: no knowledge of what
 * each section *means*, no other query params touched.
 *
 * Props:
 *   - sections ({ key, label, content }[])
 */

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import styles from "./talent-detail.module.css";

export default function TalentWorkspaceTabs({ sections }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requestedKey = searchParams.get("tab");
  const isValidKey = sections.some((section) => section.key === requestedKey);
  const activeKey = isValidKey ? requestedKey : sections?.[0]?.key;
  const active = sections.find((section) => section.key === activeKey) || sections[0];

  function handleSelect(key) {
    if (key === activeKey) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className={styles.workspace}>
      <nav className={styles.tabs} role="tablist">
        {sections.map((section) => (
          <button
            key={section.key}
            type="button"
            role="tab"
            aria-selected={section.key === active.key}
            className={section.key === active.key ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => handleSelect(section.key)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      <div className={styles.tabPanel} role="tabpanel">
        {active.content}
      </div>
    </div>
  );
}
