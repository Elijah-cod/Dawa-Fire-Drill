"use client";

import { usePreferences } from "../preferences/preferences";

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
        <legend>{t("shockPresets")}</legend>
        <div className="segmented" id="shock-presets">
          {SHOCKS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={value === shock}
              disabled={!enabled}
              onClick={() => onShock(value)}
            >
              {value}%
            </button>
          ))}
        </div>
        <p className="hint">{t("shockHint")}</p>
      </fieldset>
      {shock > 0 && (
        <fieldset>
          <legend>{t("compare")}</legend>
          <div className="segmented" id="compare">
            <button
              type="button"
              aria-pressed={compare === "none"}
              disabled={!enabled}
              onClick={() => onCompare("none")}
            >
              {t("compareNone")}
            </button>
            <button
              type="button"
              aria-pressed={compare === "shock"}
              disabled={!enabled}
              onClick={() => onCompare("shock")}
            >
              {tf("compareShock", { n: shock })}
            </button>
          </div>
        </fieldset>
      )}
      <p className="controls-status" role="status">
        {status}
      </p>
    </aside>
  );
}
