"use client";

import type { ReactNode } from "react";
import { PreferenceControls, usePreferences } from "../preferences/preferences";
import { StartTourButton, TourProvider } from "../tour/tour";
import { PrimaryNav } from "../navigation/nav";

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = usePreferences();
  return (
    <TourProvider>
      <a className="skip" href="#content">
        {t("skip")}
      </a>
      <div className="shell">
        <aside className="sidebar" aria-label="Primary navigation">
          <a className="brand" href="/">
            Dawa Fire Drill
          </a>
          <PrimaryNav label={t("navPrimary")} />
          <p>{t("syntheticNote")}</p>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <span>{t("kenya")}</span>
            <StartTourButton />
            <PreferenceControls />
          </header>
          <div className="synthetic-banner" role="note">
            {t("banner")}
          </div>
          <main id="content">{children}</main>
        </div>
      </div>
      <div className="bottom-nav">
        <PrimaryNav label={t("navMobile")} />
      </div>
    </TourProvider>
  );
}
