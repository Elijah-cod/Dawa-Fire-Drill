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

it("reserves the shock and ranked panels while the shock run is pending", async () => {
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
  } as unknown as PilotPanel;
  const scenario = {
    submit: vi.fn(async (magnitude: number) =>
      magnitude
        ? new Promise<never>(() => {})
        : {
            id: "0",
            status: "succeeded",
            horizon_days: 90,
            result: { synthetic: true, county_code: "042", stockouts: [] },
          },
    ),
    read: vi.fn(),
  };
  const { container } = render(
    <KisumuOverview panel={panel} scenario={scenario} rank={vi.fn()} canRun />,
  );
  await vi.waitFor(() =>
    expect(scenario.submit).toHaveBeenCalledWith(0, expect.any(String)),
  );
  const slot = () => container.querySelector(".shock-summary");
  expect(slot()?.getAttribute("aria-busy")).toBe("false");
  expect(
    slot()?.closest("section")?.querySelector("#shock-slider"),
  ).not.toBeNull();
  fireEvent.change(
    screen.getByLabelText(/donor logistics support reduction/i),
    { target: { value: "40" } },
  );
  expect(slot()?.getAttribute("aria-busy")).toBe("true");
  expect(slot()?.textContent).toMatch(/running illustrative scenario/i);
  expect(
    container.querySelectorAll("section.panel h2")[0]?.textContent,
  ).not.toBe("Shock-caused stockout order");
  expect(container.querySelector(".rank-placeholder")?.textContent).toMatch(
    /Do this first.*Ranking feasible actions/,
  );
});

it("renders a single facility map while the mobile sheet is open", async () => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
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
  } as unknown as PilotPanel;
  const scenario = {
    submit: vi.fn(() => new Promise<never>(() => {})),
    read: vi.fn(),
  };
  render(<KisumuOverview panel={panel} scenario={scenario} />);
  expect(screen.getAllByText("Facility locations are synthetic.")).toHaveLength(
    1,
  );
  fireEvent.click(screen.getByRole("button", { name: /open facility map/i }));
  expect(screen.getAllByText("Facility locations are synthetic.")).toHaveLength(
    1,
  );
});

it("explains Critical at no shock for facilities already short before the shock", async () => {
  const panel = {
    synthetic: true,
    county_code: "042",
    country_code: "KE",
    seed: 42,
    facilities: [
      { id: "F001", name: "Synthetic one", subcounty_id: "S1", level: 2 },
      { id: "F004", name: "Synthetic four", subcounty_id: "S1", level: 2 },
    ],
    subcounties: [{ id: "S1", name: "Synthetic group" }],
    commodities: [{ id: "C01", name: "Synthetic tracer" }],
    consumption: [
      {
        facility_id: "F001",
        commodity_id: "C01",
        month_index: 23,
        quantity: 5,
      },
      {
        facility_id: "F004",
        commodity_id: "C01",
        month_index: 23,
        quantity: 5,
      },
    ],
    stock: [
      { facility_id: "F001", commodity_id: "C01", opening_stock: 0 },
      { facility_id: "F004", commodity_id: "C01", opening_stock: 10 },
    ],
    demo_cases: {},
  } as unknown as PilotPanel;
  const scenario = {
    submit: vi.fn(async () => ({
      id: "0",
      status: "succeeded",
      horizon_days: 90,
      result: {
        synthetic: true,
        county_code: "042",
        stockouts: [{ facility_id: "F001", commodity_id: "C01", day: 1 }],
        pre_shock_stockouts: [
          { facility_id: "F001", commodity_id: "C01", day: 1 },
        ],
        baseline_stockouts: [],
        shock_caused_stockouts: [],
      },
    })),
    read: vi.fn(),
  };
  render(<KisumuOverview panel={panel} scenario={scenario} />);
  fireEvent.click(screen.getByRole("button", { name: /Synthetic one/ }));
  expect(
    await screen.findByText(/Critical · Already short before the shock/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Synthetic four/ }));
  expect(await screen.findByText(/^Stable/)).toBeTruthy();
  expect(screen.queryByText(/Already short/)).toBeNull();
});
