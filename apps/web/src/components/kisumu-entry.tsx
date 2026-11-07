"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createApiClient,
  type DemoRole,
  type FacilityView,
  type PilotPanel,
} from "../api/client";
import { createMockClient } from "../api/mock-client";
import { AuthProvider, useAuth, type AuthAdapter } from "../auth/auth-provider";
import { createDemoAdapter } from "../auth/demo-adapter";
import { RoleSwitcher } from "../auth/role-switcher";
import { usePreferences } from "../preferences/preferences";
import type { ScenarioApi } from "../scenario/use-kisumu-scenario";
import { FacilitySelf } from "./facility-self";
import { KisumuOverview } from "./kisumu-overview";

type Mode = "mock" | "demo" | "none";
type Loaded = {
  key: string;
  panel?: PilotPanel;
  facility?: FacilityView;
  error?: boolean;
};
const api = createApiClient();

function KisumuContent({
  mode,
  role,
  setRole,
}: {
  mode: Mode;
  role: DemoRole;
  setRole: (role: DemoRole) => void;
}) {
  const auth = useAuth();
  const { t } = usePreferences();
  const principal = auth.status === "authenticated" ? auth : null;
  const selectedRole = principal?.canSwitchRoles ? role : undefined;
  const scope = principal
    ? `${principal.role}:${principal.countyCode}:${principal.facilityId}:${selectedRole}`
    : "none";
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const scenario = useMemo<ScenarioApi>(
    () => ({
      submit: async (magnitude, key) => {
        const body = {
          name: "Synthetic donor shock",
          shock_type: "logistics_reduction" as const,
          magnitude,
          seed: 42,
          horizon_days: 90,
        };
        return mode === "mock"
          ? createMockClient("planner").submitRun(body)
          : api.submitRun(body, key, selectedRole);
      },
      read: (id) =>
        mode === "mock"
          ? createMockClient("planner").kisumuRun()
          : api.run(id, selectedRole),
    }),
    [mode, selectedRole],
  );
  useEffect(() => {
    if (!principal || principal.countyCode !== "042") return;
    let active = true;
    const load = async () => {
      try {
        if (principal.role === "facility") {
          if (!principal.facilityId) throw new Error("Facility scope missing");
          const facility =
            mode === "mock"
              ? await createMockClient("facility").facility(
                  principal.facilityId,
                )
              : await api.facility(principal.facilityId, 42, selectedRole);
          if (active) setLoaded({ key: scope, facility });
        } else {
          const panel =
            mode === "mock"
              ? await createMockClient("planner").pilot()
              : await api.pilot(42, selectedRole);
          if (active) setLoaded({ key: scope, panel });
        }
      } catch {
        if (active) setLoaded({ key: scope, error: true });
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [mode, principal, scope, selectedRole]);
  if (auth.status === "loading")
    return <p role="status">{t("overviewLoading")}</p>;
  if (auth.status === "missing")
    return <p role="status">{t("sessionMissing")}</p>;
  if (auth.status === "expired")
    return <p role="status">{t("sessionExpired")}</p>;
  if (auth.status !== "authenticated")
    return <p role="status">{t("overviewError")}</p>;
  return (
    <>
      <RoleSwitcher
        enabled={auth.canSwitchRoles === true}
        value={role}
        onChange={setRole}
      />
      {auth.countyCode !== "042" ? (
        <p>{t("accessDenied")}</p>
      ) : loaded?.key !== scope ? (
        <p role="status">{t("overviewLoading")}</p>
      ) : loaded.error ? (
        <p role="status">{t("overviewError")}</p>
      ) : loaded.facility ? (
        <FacilitySelf data={loaded.facility} />
      ) : loaded.panel ? (
        <KisumuOverview
          key={scope}
          panel={loaded.panel}
          scenario={scenario}
          canRun={auth.role === "planner" || auth.role === "admin"}
        />
      ) : (
        <p>{t("overviewError")}</p>
      )}
    </>
  );
}

export function KisumuEntry({ mode }: { mode: Mode }) {
  const [role, setRole] = useState<DemoRole>("planner");
  const adapter = useMemo<AuthAdapter>(() => {
    if (mode === "demo") return createDemoAdapter(api, role);
    if (mode === "mock")
      return {
        load: async () => ({
          status: "authenticated",
          role: "planner",
          countyCode: "042",
        }),
      };
    return { load: async () => ({ status: "missing" }) };
  }, [mode, role]);
  return (
    <AuthProvider adapter={adapter}>
      <KisumuContent mode={mode} role={role} setRole={setRole} />
    </AuthProvider>
  );
}
