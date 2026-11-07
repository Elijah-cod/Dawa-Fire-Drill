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
        snapshot_version: 3,
        simulation_version: 2,
        status: "succeeded",
        result: fixture.run,
        synthetic: true,
      };
    },
    async pilot() {
      if (role === "facility") throw new Error("Forbidden");
      return (await import("../fixtures/kisumu.json")).default.pilot;
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
