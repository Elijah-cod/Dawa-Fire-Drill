"use client";

import type { ReactNode } from "react";
import { PreferenceControls, usePreferences } from "../preferences/preferences";

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = usePreferences();
  return (
    <>
      <a className="skip" href="#content">
        {t("skip")}
      </a>
      <div className="shell">
        <aside className="sidebar" aria-label="Primary navigation">
          <a className="brand" href="/">
            Dawa Fire Drill
          </a>
          <nav aria-label="Primary">
            <a href="/" aria-current="page">
              {t("overview")}
            </a>
          </nav>
          <p>{t("syntheticNote")}</p>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <span>{t("kenya")}</span>
            <PreferenceControls />
          </header>
          <div className="synthetic-banner" role="note">
            {t("banner")}
          </div>
          <main id="content">{children}</main>
        </div>
      </div>
    </>
  );
}
