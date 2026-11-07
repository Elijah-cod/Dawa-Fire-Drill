import { expect, it } from "vitest";
import { ApiError } from "../api/client";
import { createDemoAdapter } from "./demo-adapter";

it("returns the verified role and role-switcher capability", async () => {
  const adapter = createDemoAdapter({
    session: async () => ({
      role: "planner",
      country_code: "KE",
      county_code: "042",
      facility_id: null,
      national_planning: false,
    }),
    capabilities: async () => ({ role_switcher: true }),
  });
  expect(await adapter.load()).toEqual({
    status: "authenticated",
    role: "planner",
    canSwitchRoles: true,
    nationalPlanning: false,
  });
});

it.each([
  [401, "expired"],
  [503, "missing"],
  [500, "error"],
] as const)("maps HTTP %s to %s", async (status, expected) => {
  const adapter = createDemoAdapter({
    session: async () => {
      throw new ApiError(status);
    },
    capabilities: async () => ({ role_switcher: false }),
  });
  expect(await adapter.load()).toEqual({ status: expected });
});
