import { ApiError, type createApiClient, type DemoRole } from "../api/client";
import type { AuthAdapter, AuthState } from "./auth-provider";

export function createDemoAdapter(
  api: Pick<ReturnType<typeof createApiClient>, "session" | "capabilities">,
  role?: DemoRole,
): AuthAdapter {
  return {
    async load(): Promise<AuthState> {
      try {
        const capability = await api.capabilities();
        const session = await api.session(
          capability.role_switcher ? role : undefined,
        );
        return {
          status: "authenticated",
          role: session.role,
          canSwitchRoles: capability.role_switcher,
          nationalPlanning: session.national_planning,
          countyCode: session.county_code,
          facilityId: session.facility_id,
        };
      } catch (error) {
        if (error instanceof ApiError && error.status === 401)
          return { status: "expired" };
        if (error instanceof ApiError && error.status === 503)
          return { status: "missing" };
        return { status: "error" };
      }
    },
  };
}
