// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { PilotPanel } from "../api/client";
import { KisumuOverview } from "./kisumu-overview";

vi.mock("./facility-map", () => ({
  FacilityMap: () => <p>Facility locations are synthetic.</p>,
}));
afterEach(cleanup);

it("updates a facility's risk and driving tracer with the selected scenario", async () => {
  const panel = {
    synthetic: true,
    county_code: "042",
    country_code: "KE",
    seed: 42,
    facilities: [
      {
        id: "F1",
        name: "Synthetic facility one",
        subcounty_id: "S1",
        level: 2,
      },
    ],
    subcounties: [{ id: "S1", name: "Synthetic group" }],
    commodities: [{ id: "C01", name: "Synthetic tracer" }],
    consumption: [
      { facility_id: "F1", commodity_id: "C01", month_index: 23, quantity: 5 },
    ],
    stock: [{ facility_id: "F1", commodity_id: "C01", opening_stock: 10 }],
  } as unknown as PilotPanel;
  const scenario = {
    submit: vi.fn(async (magnitude: number) => ({
      id: String(magnitude),
      status: "succeeded",
      horizon_days: 90,
      result: {
        synthetic: true,
        county_code: "042",
        stockouts: magnitude
          ? [{ facility_id: "F1", commodity_id: "C01", day: 7 }]
          : [],
      },
    })),
    read: vi.fn(),
  };
  render(<KisumuOverview panel={panel} scenario={scenario} />);
  fireEvent.click(
    screen.getByRole("button", { name: /Synthetic facility one/i }),
  );
  expect(await screen.findByText(/Stable.*C01/i)).toBeTruthy();
  fireEvent.change(
    screen.getByLabelText(/donor logistics support reduction/i),
    { target: { value: "40" } },
  );
  expect(await screen.findByText(/Critical.*C01.*7/i)).toBeTruthy();
  expect(
    await screen.findByText(/Shock-caused stockout details are unavailable/i),
  ).toBeTruthy();
});
