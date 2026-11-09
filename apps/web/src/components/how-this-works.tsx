"use client";

import { useEffect, useRef, useState } from "react";
import type { Coverage } from "../kisumu/view";
import { usePreferences } from "../preferences/preferences";

export const HOW_ID = "how-this-works";

/**
 * What the model does and does not do, stated only from the code: how shock-caused
 * stockouts are counted, how options are replayed and selected, and what donor stock
 * covers. Opens when the URL points at #how-this-works (the About panel links here).
 */
export function HowThisWorks({
  coverage,
  shockStockouts,
}: {
  /** Coverage of the shown run's shock-caused stockouts, when options exist. */
  coverage: Coverage | null;
  /** Shock-caused stockouts in the shown run, when known. */
  shockStockouts: number | null;
}) {
  const { t, tf } = usePreferences();
  const [open, setOpen] = useState(false);
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const follow = () => {
      if (window.location.hash !== `#${HOW_ID}`) return;
      setOpen(true);
      requestAnimationFrame(() => {
        details.current?.scrollIntoView?.({ block: "start" });
        details.current?.querySelector("summary")?.focus();
      });
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, []);
  const covered = coverage
    ? tf("howCoverage", { n: coverage.count, total: coverage.total })
    : shockStockouts
      ? tf("howCoverageNone", { total: shockStockouts })
      : t("howCoverageNoShock");
  return (
    <details
      className="panel how-it-works"
      id={HOW_ID}
      ref={details}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{t("howTitle")}</summary>
      <ul>
        <li>{t("howShockCaused")}</li>
        <li>{t("howReplay")}</li>
        <li>{t("howDonor")}</li>
        <li>{t("howNotModeled")}</li>
        <li>{t("howMap")}</li>
        <li>
          {t("howCosts")} {covered}
        </li>
      </ul>
    </details>
  );
}
