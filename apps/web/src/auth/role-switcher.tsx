"use client";

import type { DemoRole } from "../api/client";
import { usePreferences } from "../preferences/preferences";

export function RoleSwitcher({
  enabled,
  value,
  onChange,
}: {
  enabled: boolean;
  value: DemoRole;
  onChange: (value: DemoRole) => void;
}) {
  const { t } = usePreferences();
  if (!enabled) return null;
  return (
    <label>
      {t("demoRole")}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as DemoRole)}
      >
        <option value="national">{t("nationalPlanner")}</option>
        <option value="planner">{t("kisumuPlanner")}</option>
        <option value="pharmacist">{t("pharmacist")}</option>
        <option value="facility">{t("facility")}</option>
      </select>
    </label>
  );
}
