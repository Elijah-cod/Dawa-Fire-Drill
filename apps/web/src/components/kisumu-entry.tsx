"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { useSearchParams } from "next/navigation";
import { useTour } from "../tour/tour";

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
  // Stable callbacks: the page re-renders on every URL change (tabs, budget, day), and a
  // new function would make the funding trace fetch again each time.
  const rank = useMemo(
    () =>
      mode === "demo"
        ? (runId: string, body: Parameters<typeof api.rank>[1]) =>
            api.rank(runId, body, selectedRole)
        : mode === "mock"
          ? (runId: string, body: Parameters<typeof api.rank>[1]) =>
              createMockClient("planner").rank(runId, body)
          : undefined,
    [mode, selectedRole],
  );
  const trace = useMemo(
    () =>
      mode === "demo"
        ? (flowId: string, asOf: string) =>
            api.fundingTrace(flowId, asOf, selectedRole)
        : mode === "mock"
          ? (flowId: string, asOf: string) =>
              createMockClient("planner").fundingTrace(flowId, asOf)
          : undefined,
    [mode, selectedRole],
  );
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
        <FacilitySelf
          data={loaded.facility}
          capture={
            mode === "demo"
              ? {
                  upload: (file, key) =>
                    api.uploadCapture(
                      loaded.facility!.facility.id,
                      file,
                      key,
                      selectedRole,
                    ),
                  confirm: (id, fields) =>
                    api.confirmCapture(
                      loaded.facility!.facility.id,
                      id,
                      fields,
                      selectedRole,
                    ),
                }
              : mode === "mock"
                ? {
                    upload: (file) =>
                      createMockClient("facility").uploadCapture(
                        loaded.facility!.facility.id,
                        file,
                      ),
                    confirm: (id, fields) =>
                      createMockClient("facility").confirmCapture(
                        loaded.facility!.facility.id,
                        id,
                        fields,
                      ),
                  }
                : undefined
          }
        />
      ) : loaded.panel ? (
        <KisumuOverview
          key={scope}
          panel={loaded.panel}
          scenario={scenario}
          canRun={auth.role === "planner" || auth.role === "admin"}
          rank={rank}
          trace={trace}
        />
      ) : (
        <p>{t("overviewError")}</p>
      )}
    </>
  );
}

export function KisumuEntry({ mode }: { mode: Mode }) {
  // Capture belongs to the facility in-charge: the capture link and the demo's capture step
  // open that role; leaving the demo's capture step returns to the planner.
  const [role, setRole] = useState<DemoRole>("planner");
  // The capture view opens the facility role; leaving that view (a link, back or forward)
  // returns to the planner, unless the role was picked by hand.
  const view = useSearchParams()?.get("view");
  const fromView = useRef(false);
  useEffect(() => {
    if (view === "capture") {
      fromView.current = true;
      setRole("facility");
    } else if (fromView.current) {
      fromView.current = false;
      setRole("planner");
    }
  }, [view]);
  const { step } = useTour();
  const previousStep = useRef(step);
  useEffect(() => {
    if (step === "capture") setRole("facility");
    else if (previousStep.current === "capture") setRole("planner");
    previousStep.current = step;
  }, [step]);
  const adapter = useMemo<AuthAdapter>(() => {
    if (mode === "demo") return createDemoAdapter(api, role);
    if (mode === "mock")
      return {
        load: async () =>
          role === "facility"
            ? {
                status: "authenticated",
                role: "facility",
                countyCode: "042",
                facilityId: "SYN-KE-042-F001",
              }
            : { status: "authenticated", role: "planner", countyCode: "042" },
      };
    return { load: async () => ({ status: "missing" }) };
  }, [mode, role]);
  return (
    <AuthProvider adapter={adapter}>
      <KisumuContent mode={mode} role={role} setRole={setRole} />
    </AuthProvider>
  );
}
