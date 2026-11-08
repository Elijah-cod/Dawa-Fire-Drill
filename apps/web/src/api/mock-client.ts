import { fixCandidates, plannedFixes } from "./candidates";
import { ApiError } from "./client";
import type { Role, Session } from "../auth/auth-provider";
import type { components } from "../generated/api";

type CountyOverview = components["schemas"]["CountyOverview"];
type CountyRun = components["schemas"]["CountyRunRead"];

/** Reproducible backend-generated synthetic fixtures for development and tests only. */
export function createMockClient(role: Role) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Mock API is disabled in production");
  const session: Session = { role, expiresAt: Date.now() + 60 * 60 * 1000 };
  return {
    session,
    async overview(): Promise<CountyOverview> {
      if (role !== "planner" && role !== "admin") throw new Error("Forbidden");
      const fixture = (await import("../fixtures/kisumu.json")).default;
      return {
        synthetic: true,
        notice:
          "Illustrative synthetic all-sector planning proxies, not actual county budgets",
        items: fixture.planning.counties.map((county) => ({
          county_code: county.county_code,
          county_name: county.county_name,
          planning: county,
        })),
      };
    },
    async kisumuRun(): Promise<CountyRun> {
      if (role === "facility") throw new Error("Forbidden");
      const fixture = (await import("../fixtures/kisumu.json")).default;
      return {
        id: "00000000-0000-4000-8000-000000000042",
        country_code: "KE",
        county_code: "042",
        seed: 42,
        horizon_days: 90,
        snapshot_version: 4,
        simulation_version: 2,
        status: "succeeded",
        result: fixture.run,
        synthetic: true,
      };
    },
    async submitRun(
      request: components["schemas"]["CountyRunCreate"],
    ): Promise<CountyRun> {
      if (role !== "planner" && role !== "admin") throw new Error("Forbidden");
      if (
        request.seed !== 42 ||
        request.horizon_days !== 90 ||
        request.shock_type !== "logistics_reduction" ||
        ![0, 40].includes(request.magnitude)
      ) {
        throw new Error("Synthetic fixture unavailable for these inputs");
      }
      const fixture = (await import("../fixtures/kisumu.json")).default;
      return {
        id:
          request.magnitude === 0
            ? "00000000-0000-4000-8000-000000000040"
            : "00000000-0000-4000-8000-000000000042",
        country_code: "KE",
        county_code: "042",
        seed: 42,
        horizon_days: 90,
        snapshot_version: 4,
        simulation_version: 2,
        status: "succeeded",
        result: request.magnitude === 0 ? fixture.baseline : fixture.run,
        synthetic: true,
      };
    },
    async pilot() {
      if (role === "facility") throw new Error("Forbidden");
      return (await import("../fixtures/kisumu.json")).default.pilot;
    },
    async rank(
      runId: string,
      request: components["schemas"]["ModeledRequest"],
    ): Promise<components["schemas"]["ModeledResponse"]> {
      if (role !== "planner" && role !== "admin") throw new Error("Forbidden");
      const fixture = (await import("../fixtures/kisumu.json")).default;
      const expected = fixCandidates(
        plannedFixes(
          fixture.run.shock_caused_stockouts,
          fixture.pilot.demo_cases.transfer_routes,
        ),
      );
      const recorded = (await import("../fixtures/ranked-fixes.json"))
        .default as Record<string, components["schemas"]["ModeledResponse"]>;
      if (
        runId !== "00000000-0000-4000-8000-000000000042" ||
        request.synthetic_attested !== true ||
        request.minimum_benefit != null ||
        !(String(request.budget) in recorded) ||
        JSON.stringify(request.candidates) !== JSON.stringify(expected)
      )
        throw new Error(
          "Synthetic ranking fixture unavailable for these inputs",
        );
      return recorded[String(request.budget)];
    },
    /** No extraction provider in fixture mode: fields come back empty for manual entry. */
    async uploadCapture(
      facilityId: string,
      file: File,
    ): Promise<components["schemas"]["CaptureRead"]> {
      if (role !== "facility" || facilityId !== "SYN-KE-042-F001")
        throw new Error("Forbidden");
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
        throw new ApiError(422, "Invalid image");
      return {
        id: "00000000-0000-4000-8000-0000000000c1",
        country_code: "KE",
        facility_id: facilityId,
        fields: {
          commodity_name: null,
          opening_balance: null,
          closing_balance: null,
          record_date: null,
        },
        provider_status: "manual_unavailable",
        status: "pending" as const,
        created_at: "2026-11-08T00:00:00Z",
        synthetic: true,
        notice: "Synthetic capture; no extraction provider in fixture mode",
      };
    },
    async confirmCapture(
      facilityId: string,
      captureId: string,
      fields: components["schemas"]["BinCardFields"],
    ) {
      if (role !== "facility" || facilityId !== "SYN-KE-042-F001")
        throw new Error("Forbidden");
      return {
        synthetic: true as const,
        capture_id: captureId,
        facility_id: facilityId,
        fields,
      };
    },
    async fundingTrace(
      flowId: string,
      asOf: string,
    ): Promise<components["schemas"]["FundingTraceResponse"]> {
      if (role !== "planner" && role !== "admin") throw new Error("Forbidden");
      const fixture = (await import("../fixtures/kisumu.json")).default;
      const flow = fixture.pilot.demo_cases.stalled_release;
      if (flowId !== flow.id || asOf !== flow.as_of)
        throw new Error(
          "Synthetic funding fixture unavailable for these inputs",
        );
      return fixture.funding;
    },
    async facility(facilityId: string) {
      if (role === "facility" && facilityId !== "SYN-KE-042-F001")
        throw new Error("Forbidden");
      const panel = (await import("../fixtures/kisumu.json")).default.pilot;
      const facility = panel.facilities.find((item) => item.id === facilityId);
      if (!facility) throw new Error("Not found");
      return {
        synthetic: true,
        notice: "Illustrative synthetic facility data; not real records",
        country_code: "KE",
        county_code: "042",
        facility,
        stock: panel.stock.filter((item) => item.facility_id === facilityId),
        consumption: panel.consumption.filter(
          (item) => item.facility_id === facilityId,
        ),
        commodities: panel.commodities,
      };
    },
  };
}
