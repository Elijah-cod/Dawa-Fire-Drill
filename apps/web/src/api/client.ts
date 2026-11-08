import type { components } from "../generated/api";

export type DemoRole = "national" | "planner" | "pharmacist" | "facility";
type GeneratedPilot = (typeof import("../fixtures/kisumu.json"))["pilot"];
type GeneratedFacility = GeneratedPilot["facilities"][number];
export type PilotPanel = Omit<GeneratedPilot, "facilities"> & {
  facilities: (Omit<
    GeneratedFacility,
    "latitude" | "longitude" | "coordinates_synthetic"
  > &
    Partial<
      Pick<
        GeneratedFacility,
        "latitude" | "longitude" | "coordinates_synthetic"
      >
    >)[];
};
export type FacilityView = {
  synthetic: boolean;
  country_code: string;
  county_code: string;
  facility: PilotPanel["facilities"][number];
  stock: PilotPanel["stock"];
  consumption: PilotPanel["consumption"];
  commodities: PilotPanel["commodities"];
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail?: string,
  ) {
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

async function post<T>(
  path: string,
  body: unknown,
  key: string,
  role?: DemoRole,
): Promise<T> {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Idempotency-Key": key,
  });
  if (role) headers.set("X-Demo-Role", role);
  const response = await fetch(`/api${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const detail =
      payload &&
      typeof payload === "object" &&
      "detail" in payload &&
      typeof payload.detail === "string"
        ? payload.detail
        : undefined;
    throw new ApiError(response.status, detail);
  }
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
    pilot: async (seed: number, role?: DemoRole) => {
      const result = await get<PilotPanel>(
        `/counties/042/pilot?seed=${encodeURIComponent(seed)}`,
        role,
      );
      if (
        !result ||
        result.synthetic !== true ||
        result.county_code !== "042" ||
        !Array.isArray(result.facilities) ||
        !Array.isArray(result.subcounties) ||
        !Array.isArray(result.commodities) ||
        !Array.isArray(result.stock) ||
        !Array.isArray(result.consumption)
      ) {
        throw new Error("Invalid synthetic pilot");
      }
      return result;
    },
    facility: async (id: string, seed: number, role?: DemoRole) => {
      const result = await get<FacilityView>(
        `/counties/042/facilities/${encodeURIComponent(id)}?seed=${encodeURIComponent(seed)}`,
        role,
      );
      if (
        !result ||
        result.synthetic !== true ||
        result.county_code !== "042" ||
        result.facility?.id !== id ||
        !Array.isArray(result.stock) ||
        !Array.isArray(result.consumption)
      )
        throw new Error("Invalid synthetic facility");
      return result;
    },
    submitRun: (
      body: components["schemas"]["CountyRunCreate"],
      key: string,
      role?: DemoRole,
    ) =>
      post<components["schemas"]["CountyRunRead"]>(
        "/counties/042/runs",
        body,
        key,
        role,
      ),
    run: (id: string, role?: DemoRole) =>
      get<components["schemas"]["CountyRunRead"]>(
        `/counties/042/runs/${encodeURIComponent(id)}`,
        role,
      ),
    rank: (
      id: string,
      body: components["schemas"]["ModeledRequest"],
      role?: DemoRole,
    ) =>
      post<components["schemas"]["ModeledResponse"]>(
        `/counties/042/runs/${encodeURIComponent(id)}/mitigations`,
        body,
        crypto.randomUUID(),
        role,
      ),
  };
}
