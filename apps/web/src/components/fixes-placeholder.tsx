"use client";

import { usePreferences } from "../preferences/preferences";

/** Same footprint as the loaded panel so arriving results do not shift the page. */
export function FixesPlaceholder({ message }: { message?: string }) {
  const { t } = usePreferences();
  return (
    <section
      className="panel fixes fixes-placeholder"
      aria-labelledby="fixes-title"
      aria-busy="true"
    >
      <h2 id="fixes-title">{t("fixesTitle")}</h2>
      <p className="state" role="status">
        {message ?? t("fixesLoading")}
      </p>
      <div className="skeleton" style={{ width: "80%" }} />
      <div className="skeleton" style={{ width: "60%" }} />
      <div className="skeleton" style={{ width: "70%" }} />
    </section>
  );
}
