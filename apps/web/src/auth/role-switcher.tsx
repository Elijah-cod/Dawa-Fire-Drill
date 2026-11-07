"use client";

import type { DemoRole } from "../api/client";

export function RoleSwitcher({
  enabled,
  value,
  onChange,
}: {
  enabled: boolean;
  value: DemoRole;
  onChange: (value: DemoRole) => void;
}) {
  if (!enabled) return null;
  return (
    <label>
      Demo role
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as DemoRole)}
      >
        <option value="national">National planner</option>
        <option value="planner">Kisumu planner</option>
        <option value="pharmacist">Pharmacist</option>
        <option value="facility">Facility</option>
      </select>
    </label>
  );
}
