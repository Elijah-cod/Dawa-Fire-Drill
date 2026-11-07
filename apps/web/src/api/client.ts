import type { components } from "../generated/api";

export type DemoRole = "national" | "planner" | "pharmacist" | "facility";

export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(`API request failed (${status})`);
  }
}

async function get<T>(path: string, role?: DemoRole): Promise<T> {
  const headers = new Headers();
  if (role) headers.set("X-Demo-Role", role);
  const response = await fetch(`/api${path}`, { headers, cache: "no-store" });
  if (!response.ok) throw new ApiError(response.status);
  return (await response.json()) as T;
}

/** Response types are generated from the backend OpenAPI schema. */
export function createApiClient() {
  return {
    session: (role?: DemoRole) =>
      get<components["schemas"]["DemoSession"]>("/demo/session", role),
    capabilities: () =>
      get<components["schemas"]["DemoCapabilities"]>("/demo/capabilities"),
    overview: (seed: number, role?: DemoRole) =>
      get<components["schemas"]["CountyOverview"]>(
        `/counties/overview?seed=${encodeURIComponent(seed)}`,
        role,
      ),
  };
}
