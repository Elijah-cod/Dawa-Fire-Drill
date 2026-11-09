"use client";

import { usePreferences } from "../preferences/preferences";
import { RadioGroup } from "./radio-group";

/** The four prepared shocks; the backend can run others, but the demo prepares these. */
export const SHOCKS = [0, 20, 40, 100] as const;
export type Shock = (typeof SHOCKS)[number];
export type Compare = "shock" | "none";

/** Shock presets and the no-shock comparison. On phones the panel opens from "Change scenario". */
export function ScenarioControls({
  shock,
  compare,
  enabled,
  open,
  status,
  onShock,
  onCompare,
}: {
  shock: Shock;
  compare: Compare;
  enabled: boolean;
  open: boolean;
  status?: string;
  onShock: (value: Shock) => void;
  onCompare: (value: Compare) => void;
}) {
  const { t, tf } = usePreferences();
  return (
    <aside
      className="panel controls"
      id="scenario-controls"
      aria-label={t("controlsLabel")}
      data-open={open}
    >
      <fieldset>
        <legend id="shock-presets-label">{t("shockPresets")}</legend>
        <RadioGroup
          id="shock-presets"
          labelledBy="shock-presets-label"
          options={SHOCKS.map((value) => ({ value, label: `${value}%` }))}
          value={shock}
          disabled={!enabled}
          onChange={onShock}
        />
        <p className="hint">{t("shockHint")}</p>
      </fieldset>
      {shock > 0 && (
        <fieldset>
          <legend id="compare-label">{t("compare")}</legend>
          <RadioGroup<Compare>
            id="compare"
            labelledBy="compare-label"
            options={[
              { value: "none", label: t("compareNone") },
              { value: "shock", label: tf("compareShock", { n: shock }) },
            ]}
            value={compare}
            disabled={!enabled}
            onChange={onCompare}
          />
        </fieldset>
      )}
      <p className="controls-status" role="status">
        {status}
      </p>
    </aside>
  );
}
