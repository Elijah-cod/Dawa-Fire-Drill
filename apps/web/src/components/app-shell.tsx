"use client";

import { useState, type ReactNode } from "react";
import { PreferenceControls, usePreferences } from "../preferences/preferences";
import { StartTourButton, TourProvider } from "../tour/tour";
import { PrimaryNav } from "../navigation/nav";

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = usePreferences();
  const [about, setAbout] = useState(false);
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
        </aside>
        <div className="workspace">
          <header className="topbar">
            <a className="brand topbar-brand" href="/">
              Dawa Fire Drill
            </a>
            <span className="workspace-name">{t("kenya")}</span>
            <StartTourButton />
            <PreferenceControls />
          </header>
          <div className="synthetic-banner" role="note">
            <span>
              {process.env.NEXT_PUBLIC_STATIC_DEMO === "1" && (
                <strong className="static-demo">{t("staticDemo")} </strong>
              )}
              {t("banner")}
            </span>
            <button
              type="button"
              className="link-button"
              aria-expanded={about}
              aria-controls="about-demo"
              onClick={() => setAbout(!about)}
            >
              {t("aboutLink")}
            </button>
          </div>
          <div className="about" id="about-demo" hidden={!about}>
            <p>{t("aboutSandbox")}</p>
            <p>{t("aboutInvented")}</p>
            <p>{t("aboutMethod")}</p>
            <p>{t("aboutTerms")}</p>
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
