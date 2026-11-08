// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { PilotPanel } from "../api/client";
import { KisumuOverview } from "../components/kisumu-overview";
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
    (await screen.findByRole("button", { name: "40%" })).getAttribute(
      "aria-pressed",
    ),
  ).toBe("true");
  expect(screen.getAllByText("40% logistics cut").length).toBeGreaterThan(0);
  await vi.waitFor(() =>
    expect(scenario.submit).toHaveBeenCalledWith(40, expect.any(String)),
  );
});
