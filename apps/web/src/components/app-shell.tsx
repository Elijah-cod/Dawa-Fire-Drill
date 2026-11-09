"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PreferenceControls, usePreferences } from "../preferences/preferences";
import { StartTourButton, TourProvider } from "../tour/tour";
import { PrimaryNav } from "../navigation/nav";

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = usePreferences();
  const [about, setAbout] = useState(false);
  // The phone bottom bar grows with larger text; publish its real height so the page
  // padding and focus scrolling keep content clear of it.
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = bar.current;
    if (!element) return;
    const update = () => {
      const height = element.getBoundingClientRect().height;
      document.documentElement.style.setProperty(
        "--bottom-bar",
        `${Math.ceil(height)}px`,
      );
    };
    update();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);
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
            <p>
              {/* A plain link so the hash change opens the disclosure on the Kisumu page. */}
              <a href="/kisumu#how-this-works">{t("aboutHowLink")}</a>
            </p>
          </div>
          <main id="content">{children}</main>
        </div>
      </div>
      <div className="bottom-nav" ref={bar}>
        <PrimaryNav label={t("navMobile")} />
      </div>
    </TourProvider>
  );
}
