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

export function validFundingTrace(
  value: unknown,
): value is components["schemas"]["FundingTraceResponse"] {
  if (!value || typeof value !== "object") return false;
  const trace = value as Record<string, unknown>;
  return (
    trace.synthetic === true &&
    trace.currency === "KES" &&
    Array.isArray(trace.bottlenecks) &&
    trace.bottlenecks.every(
      (item: unknown) =>
        !!item &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).stage === "string" &&
        Number.isInteger((item as Record<string, unknown>).amount) &&
        Number.isInteger((item as Record<string, unknown>).age_days),
    )
  );
}

export type CaptureRead = components["schemas"]["CaptureRead"];
export type BinCardFields = components["schemas"]["BinCardFields"];
export type CaptureConfirmed = {
  synthetic: true;
  capture_id: string;
  facility_id: string;
  fields: BinCardFields;
};

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
    uploadCapture: async (
      facilityId: string,
      file: File,
      key: string,
      role?: DemoRole,
    ) => {
      const body = new FormData();
      body.set("synthetic_attested", "true");
      body.set("file", file);
      const headers = new Headers({ "Idempotency-Key": key });
      if (role) headers.set("X-Demo-Role", role);
      const response = await fetch(
        `/api/counties/042/facilities/${encodeURIComponent(facilityId)}/captures?seed=42`,
        { method: "POST", headers, body, cache: "no-store" },
      );
      if (!response.ok) throw new ApiError(response.status);
      const result = (await response.json()) as CaptureRead;
      if (
        result?.synthetic !== true ||
        result.facility_id !== facilityId ||
        typeof result.id !== "string" ||
        !result.fields ||
        typeof result.fields !== "object"
      )
        throw new Error("Invalid synthetic capture");
      return result;
    },
    confirmCapture: async (
      facilityId: string,
      captureId: string,
      fields: BinCardFields,
      role?: DemoRole,
    ) => {
      const result = await post<CaptureConfirmed>(
        `/counties/042/facilities/${encodeURIComponent(facilityId)}/captures/${encodeURIComponent(captureId)}/confirm`,
        { reviewed: true, fields },
        crypto.randomUUID(),
        role,
      );
      if (
        result?.synthetic !== true ||
        result.capture_id !== captureId ||
        result.facility_id !== facilityId
      )
        throw new Error("Invalid capture confirmation");
      return result;
    },
    fundingTrace: async (flowId: string, asOf: string, role?: DemoRole) => {
      const result = await get<components["schemas"]["FundingTraceResponse"]>(
        `/counties/042/funding/${encodeURIComponent(flowId)}/trace?seed=42&as_of=${encodeURIComponent(asOf)}`,
        role,
      );
      if (!validFundingTrace(result)) throw new Error("Invalid funding trace");
      return result;
    },
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
