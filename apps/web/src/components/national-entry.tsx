"use client";

import { useCallback, useMemo, useState } from "react";
import { createApiClient, type DemoRole } from "../api/client";
import { createMockClient } from "../api/mock-client";
import { AuthProvider, useAuth, type AuthAdapter } from "../auth/auth-provider";
import { createDemoAdapter } from "../auth/demo-adapter";
import { RoleSwitcher } from "../auth/role-switcher";
import { usePreferences } from "../preferences/preferences";
import { NationalOverview } from "./national-overview";

type Mode = "mock" | "demo" | "none";
const api = createApiClient();

function NationalContent({
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
  const loadOverview = useCallback(() => {
    if (mode === "mock") return createMockClient("planner").overview();
    return api.overview(
      42,
      auth.status === "authenticated" &&
        auth.canSwitchRoles &&
        role === "national"
        ? "national"
        : undefined,
    );
  }, [mode, role, auth]);
  if (auth.status === "loading")
    return <p role="status">{t("overviewLoading")}</p>;
  if (auth.status === "missing")
    return <p role="status">{t("sessionMissing")}</p>;
  if (auth.status === "expired")
    return <p role="status">{t("sessionExpired")}</p>;
  if (auth.status === "error") return <p role="status">{t("overviewError")}</p>;
  if (auth.status !== "authenticated") return null;
  return (
    <>
      <RoleSwitcher
        enabled={auth.canSwitchRoles === true}
        value={role}
        onChange={setRole}
      />
      {mode === "mock" ||
      auth.nationalPlanning ||
      (auth.canSwitchRoles && role === "national") ? (
        <NationalOverview loadOverview={loadOverview} />
      ) : (
        <p>{t("accessDenied")}</p>
      )}
    </>
  );
}

export function NationalEntry({ mode }: { mode: Mode }) {
  const [role, setRole] = useState<DemoRole>("national");
  const adapter = useMemo<AuthAdapter>(() => {
    if (mode === "demo") return createDemoAdapter(api, role);
    if (mode === "mock")
      return {
        load: async () => ({
          status: "authenticated",
          role: "planner",
          nationalPlanning: true,
        }),
      };
    return { load: async () => ({ status: "missing" }) };
  }, [mode, role]);
  return (
    <AuthProvider adapter={adapter}>
      <NationalContent mode={mode} role={role} setRole={setRole} />
    </AuthProvider>
  );
}
