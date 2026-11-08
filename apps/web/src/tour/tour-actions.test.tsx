// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { PilotPanel } from "../api/client";
import { KisumuOverview } from "../components/kisumu-overview";
import { RankedFixes } from "../components/ranked-fixes";
import { TourProvider } from "./tour";

vi.mock("next/navigation", () => ({
  usePathname: () => "/kisumu",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("../components/facility-map", () => ({
  FacilityMap: () => <p>Facility locations are synthetic.</p>,
}));
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});
Element.prototype.scrollIntoView = vi.fn();

const route = {
  synthetic: true,
  facility_id: "F001",
  donor_facility_id: "F002",
  commodity_id: "C02",
  quantity: 100,
  available_units: 600,
  dispatch_day: 45,
  arrival_day: 46,
  expiry_day: 90,
  minimum_shelf_days: 7,
  distance_km: 7,
  maximum_distance_km: 30,
};

it("ranks once at the default ceiling when the demo reaches the ranked-fix step", async () => {
  window.history.replaceState(null, "", "/kisumu?tour=rank");
  const rank = vi.fn(() => new Promise<never>(() => {}));
  render(
    <TourProvider>
      <RankedFixes
        runId="run-1"
        target={{ facility_id: "F001", commodity_id: "C02", day: 48 }}
        transfer={route}
        rank={rank}
      />
    </TourProvider>,
  );
  await waitFor(() => expect(rank).toHaveBeenCalledTimes(1));
  expect(rank).toHaveBeenCalledWith(expect.objectContaining({ budget: 100 }));
});

it("does not rank by itself outside the demo", async () => {
  const rank = vi.fn();
  render(
    <TourProvider>
      <RankedFixes
        runId="run-1"
        target={{ facility_id: "F001", commodity_id: "C02", day: 48 }}
        transfer={route}
        rank={rank}
      />
    </TourProvider>,
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(rank).not.toHaveBeenCalled();
});

it("applies the 40% shock during the demo's shock steps", async () => {
  window.history.replaceState(null, "", "/kisumu?tour=shock");
  const panel = {
    synthetic: true,
    county_code: "042",
    country_code: "KE",
    seed: 42,
    facilities: [],
    subcounties: [],
    commodities: [],
    consumption: [],
    stock: [],
    demo_cases: {},
  } as unknown as PilotPanel;
  const scenario = {
    submit: vi.fn(() => new Promise<never>(() => {})),
    read: vi.fn(),
  };
  render(
    <TourProvider>
      <KisumuOverview panel={panel} scenario={scenario} canRun />
    </TourProvider>,
  );
  expect(
    await screen.findByText(/Donor logistics support reduction: 40%/),
  ).toBeTruthy();
});
