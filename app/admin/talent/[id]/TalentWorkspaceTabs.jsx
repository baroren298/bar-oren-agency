"use client";

/*
 * TalentWorkspaceTabs — Talent Workspace Foundation sprint.
 *
 * The talent workspace's section navigation (sprint requirement #2):
 * פרטים / גלריה / רשתות / SEO / היסטוריה. Client component only because it
 * needs local state for which tab is active — the section *content* itself
 * is still rendered server-side by ../[id]/page.jsx (a Server Component)
 * and simply passed in as `sections[i].content`, the same pattern
 * AdminShell already uses for its children.
 *
 * Deliberately dumb: no routing, no query-string sync, no knowledge of
 * what each section *means* — adding a real route per section (e.g. once
 * editing lands) is a later sprint's concern and won't require touching
 * this component's contract.
 *
 * Props:
 *   - sections ({ key, label, content }[])
 */

import { useState } from "react";
import styles from "./talent-detail.module.css";

export default function TalentWorkspaceTabs({ sections }) {
  const [activeKey, setActiveKey] = useState(sections?.[0]?.key);
  const active = sections.find((section) => section.key === activeKey) || sections[0];

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
            onClick={() => setActiveKey(section.key)}
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
