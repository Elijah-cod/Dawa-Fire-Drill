// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { PilotPanel } from "../api/client";
import fixture from "../fixtures/kisumu.json";
import { KisumuOverview } from "./kisumu-overview";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("./facility-map", () => ({
  FacilityMap: () => <p>Facility locations are synthetic.</p>,
}));
afterEach(() => {
  cleanup();
  // The page writes its view into the URL; start each test from a clean link.
  window.history.replaceState(null, "", "/");
});

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
  // Invented display names replace the generator's numbered names.
  fireEvent.click(screen.getByRole("tab", { name: /Facilities/ }));
  fireEvent.click(
    screen.getByRole("button", { name: "Acacia Ridge Dispensary" }),
  );
  const detail = () => document.getElementById("facility-detail")!;
  await vi.waitFor(() =>
    expect(detail().textContent).toMatch(
      /Critical.*Synthetic tracer · Runs out on day 7 of the run/,
    ),
  );
  expect(
    (
      await screen.findAllByText(
        /Stockout details are unavailable for this run/i,
      )
    ).length,
  ).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("radio", { name: "0%" }));
  await vi.waitFor(() =>
    expect(detail().textContent).toMatch(/Later.*Synthetic tracer/),
  );
});

it("keeps the previous verdict, marked busy, while another shock runs", async () => {
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
      magnitude === 20
        ? new Promise<never>(() => {})
        : {
            id: String(magnitude),
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
    expect(scenario.submit).toHaveBeenCalledWith(40, expect.any(String)),
  );
  const verdict = () => container.querySelector("#verdict");
  await vi.waitFor(() =>
    expect(verdict()?.getAttribute("aria-busy")).toBe("false"),
  );
  expect(screen.getByRole("radio", { name: "40%" })).toHaveProperty(
    "ariaChecked",
    "true",
  );
  fireEvent.click(screen.getByRole("radio", { name: "20%" }));
  expect(verdict()?.getAttribute("aria-busy")).toBe("true");
  expect(
    screen.getByRole("complementary", { name: "Scenario" }).textContent,
  ).toMatch(/Running the 20% scenario…/);
  expect(container.querySelector(".fixes-placeholder")?.textContent).toMatch(
    /Cheapest fixes.*Loading the ranked fixes…/,
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
  // The facility map lives in the Facilities tab; Map and fixes holds the area map.
  fireEvent.click(screen.getByRole("tab", { name: /Facilities/ }));
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
  fireEvent.click(screen.getByRole("tab", { name: /Facilities/ }));
  fireEvent.click(
    screen.getByRole("button", { name: "Acacia Ridge Dispensary" }),
  );
  const detail = () => document.getElementById("facility-detail")!;
  await vi.waitFor(() =>
    expect(detail().textContent).toMatch(
      /Critical · Already short before the shock/,
    ),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Mvule Ridge Dispensary" }),
  );
  await vi.waitFor(() => expect(detail().textContent).toMatch(/StatusLater/));
  expect(document.getElementById("facility-detail")?.textContent).not.toMatch(
    /Already short/,
  );
});

/** The mock client's backend runs at the four prepared shocks. */
function fixtureScenario() {
  return {
    submit: vi.fn(async (magnitude: number) => ({
      id: String(magnitude),
      status: "succeeded",
      horizon_days: 90,
      result: {
        synthetic: true,
        county_code: "042",
        ...fixture.risk_runs[String(magnitude) as "0" | "20" | "40" | "100"],
      },
    })),
    read: vi.fn(),
  };
}

it("answers what breaks first at each prepared shock from the backend runs", async () => {
  const { container } = render(
    <KisumuOverview panel={fixture.pilot} scenario={fixtureScenario()} />,
  );
  const verdict = () => container.querySelector("#verdict")!;
  await vi.waitFor(() =>
    expect(verdict().textContent).toContain(
      "A 40% cut in donor logistics support causes 209 stockouts within 90 days; Tamarind Crossing Sub-County Hospital (Kisumu West) runs out of family planning tracer 04 first, on day 41.",
    ),
  );
  expect(verdict().textContent).toContain(
    "The fixes address only the 4 earliest of 209 shock-caused stockouts.",
  );
  expect(verdict().textContent).toContain(
    "211 stockouts = 209 caused by the shock + 2 already short before it",
  );
  expect(verdict().textContent).toContain("10 Critical · 18 Watch · 12 Later");

  fireEvent.click(screen.getByRole("radio", { name: "20%" }));
  await vi.waitFor(() =>
    expect(verdict().textContent).toContain(
      "The fixes address only 4 of 77 shock-caused stockouts (days 47 to 74).",
    ),
  );
  expect(verdict().textContent).toContain("2 Critical · 5 Watch · 33 Later");

  fireEvent.click(screen.getByRole("radio", { name: "100%" }));
  await vi.waitFor(() =>
    expect(verdict().textContent).toContain(
      "None of the 4 listed transfers can arrive in time: they arrive from day 39, but their stockouts happen by day 26.",
    ),
  );
  expect(verdict().textContent).toContain("40 Critical · 0 Watch · 0 Later");
  expect(verdict().textContent).toContain("causes 393 stockouts");

  fireEvent.click(screen.getByRole("radio", { name: "0%" }));
  await vi.waitFor(() =>
    expect(verdict().textContent).toContain(
      "With no shock, nothing new runs out within 90 days.There is nothing to fix.",
    ),
  );
  expect(verdict().textContent).toContain("2 Critical · 0 Watch · 38 Later");
  expect(verdict().textContent).not.toMatch(/Stable/);
  expect(screen.queryByRole("group", { name: "Compare" })).toBeNull();
});

it("makes the verdict's highlighted phrases real controls", async () => {
  render(<KisumuOverview panel={fixture.pilot} scenario={fixtureScenario()} />);
  const verdict = await screen.findByRole("region", {
    name: "What breaks first",
  });
  const count = await within(verdict).findByRole("link", {
    name: "209 stockouts",
  });
  fireEvent.click(count);
  await vi.waitFor(() =>
    expect(document.activeElement?.id).toBe("stockout-order"),
  );
  expect(
    screen
      .getByRole("tab", { name: /Stockout order/ })
      .getAttribute("aria-selected"),
  ).toBe("true");
  fireEvent.click(
    within(verdict).getByRole("link", {
      name: "Tamarind Crossing Sub-County Hospital (Kisumu West)",
    }),
  );
  await vi.waitFor(() =>
    expect(document.activeElement?.id).toBe("facility-detail"),
  );
  expect(
    screen
      .getByRole("tab", { name: /Facilities/ })
      .getAttribute("aria-selected"),
  ).toBe("true");
  expect(
    screen.getByRole("heading", {
      name: "Tamarind Crossing Sub-County Hospital · SYN-KE-042-F031",
    }),
  ).toBeTruthy();
});

it("compares the selected shock with the no-shock run", async () => {
  const scenario = fixtureScenario();
  const { container } = render(
    <KisumuOverview panel={fixture.pilot} scenario={scenario} />,
  );
  await vi.waitFor(() =>
    expect(container.querySelector("#verdict")?.textContent).toContain(
      "209 stockouts",
    ),
  );
  fireEvent.click(screen.getByRole("radio", { name: "No shock" }));
  await vi.waitFor(() =>
    expect(container.querySelector("#verdict")?.textContent).toContain(
      "With no shock",
    ),
  );
  expect(screen.getByRole("radio", { name: "40%" })).toHaveProperty(
    "ariaChecked",
    "true",
  );
  fireEvent.click(screen.getByRole("radio", { name: "40% cut" }));
  await vi.waitFor(() =>
    expect(container.querySelector("#verdict")?.textContent).toContain(
      "209 stockouts",
    ),
  );
});

it("opens the scenario controls from Change scenario on phones", () => {
  render(
    <KisumuOverview
      panel={fixture.pilot}
      scenario={{
        submit: vi.fn(() => new Promise<never>(() => {})),
        read: vi.fn(),
      }}
    />,
  );
  const toggle = screen.getByRole("button", { name: /Change scenario/ });
  const controls = screen.getByRole("complementary", { name: "Scenario" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(controls.dataset.open).toBe("false");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(controls.dataset.open).toBe("true");
});

it("sorts the facilities table and opens a facility's detail from its row", async () => {
  render(<KisumuOverview panel={fixture.pilot} scenario={fixtureScenario()} />);
  fireEvent.click(screen.getByRole("tab", { name: /Facilities/ }));
  const table = screen.getByRole("region", { name: "Facilities table" });
  expect(table.tabIndex).toBe(0);
  await vi.waitFor(() =>
    expect(within(table).getAllByRole("row")[1].textContent).toMatch(
      /Critical/,
    ),
  );
  // Worst status first by default; then soonest first stockout.
  fireEvent.click(
    within(table).getByRole("button", { name: /First stockout/ }),
  );
  const rows = () => within(table).getAllByRole("row").slice(1);
  expect(rows()[0].textContent).toContain(
    "Acacia Ridge DispensaryKisumu CentralCritical1 · antimalarial tracer 01",
  );
  expect(
    within(table)
      .getByRole("columnheader", { name: /First stockout/ })
      .getAttribute("aria-sort"),
  ).toBe("ascending");
  fireEvent.click(
    within(table).getByRole("button", {
      name: "Tamarind Crossing Sub-County Hospital",
    }),
  );
  const detail = document.getElementById("facility-detail")!;
  expect(detail.textContent).toContain(
    "Tamarind Crossing Sub-County Hospital · SYN-KE-042-F031",
  );
  expect(detail.textContent).toContain("Family planning tracer 04: day 41");
  // Day wording: the run's day number, never "days to stockout".
  expect(detail.textContent).toContain("Runs out on day 41 of the run");
  expect(detail.textContent).not.toMatch(/days to stockout/);
  expect(detail.textContent).not.toMatch(/Planted/);
  expect(detail.textContent).toMatch(
    /Example transfer: family planning tracer 04 from .+, \d+(\.\d+)? km away, arriving on day \d+\./,
  );
  expect(
    rows().find((row) => row.getAttribute("aria-selected") === "true")
      ?.textContent,
  ).toMatch(/^Tamarind Crossing Sub-County Hospital/);
});

it("filters the facilities by status, sub-county and commodity without changing the verdict", async () => {
  const { container } = render(
    <KisumuOverview panel={fixture.pilot} scenario={fixtureScenario()} />,
  );
  await vi.waitFor(() =>
    expect(container.querySelector("#verdict")?.textContent).toContain(
      "10 Critical · 18 Watch · 12 Later",
    ),
  );
  fireEvent.click(screen.getByRole("tab", { name: /Facilities/ }));
  const table = screen.getByRole("region", { name: "Facilities table" });
  const rows = () => within(table).getAllByRole("row").slice(1);
  const count = () => container.querySelector(".filter-count")?.textContent;
  expect(count()).toBe("Showing 40 of 40 facilities.");
  const critical = screen.getByRole("button", { name: "Critical" });
  fireEvent.click(critical);
  expect(critical.getAttribute("aria-pressed")).toBe("true");
  expect(rows()).toHaveLength(10);
  expect(rows().every((row) => /Critical/.test(row.textContent ?? ""))).toBe(
    true,
  );
  fireEvent.change(screen.getByLabelText("Sub-county"), {
    target: { value: "SYN-042-S03" },
  });
  expect(rows().length).toBeLessThan(10);
  expect(rows().every((row) => /Kisumu West/.test(row.textContent ?? ""))).toBe(
    true,
  );
  fireEvent.change(screen.getByLabelText("Sub-county"), {
    target: { value: "all" },
  });
  // One commodity: status and first stockout come from that commodity alone.
  fireEvent.change(screen.getByLabelText("Commodity"), {
    target: { value: "SYN-C04" },
  });
  expect(count()).toMatch(/^Showing \d+ of 40 facilities\.$/);
  expect(
    rows().every((row) =>
      /— *$|family planning tracer 04$/.test(row.textContent ?? ""),
    ),
  ).toBe(true);
  fireEvent.click(critical);
  fireEvent.click(screen.getByRole("button", { name: "Later" }));
  fireEvent.click(screen.getByRole("button", { name: "Watch" }));
  expect(rows().length).toBeGreaterThan(0);
  expect(container.querySelector("#verdict")?.textContent).toContain(
    "10 Critical · 18 Watch · 12 Later",
  );
});

it("frames the question at full size until the first run arrives", () => {
  const { container } = render(
    <KisumuOverview
      panel={fixture.pilot}
      scenario={{
        submit: vi.fn(() => new Promise<never>(() => {})),
        read: vi.fn(),
      }}
    />,
  );
  expect(container.querySelector(".verdict-lead")?.textContent).toBe(
    "Stress-testing Kisumu: what breaks first if donor logistics support is cut, and what is the cheapest fix?",
  );
  expect(container.querySelector(".verdict-fix")?.textContent).toBe("");
  expect(
    screen.getByRole("complementary", { name: "Scenario" }).textContent,
  ).toContain("Running the 40% scenario…");
});

it("restores shock, budget, tab and day from a shared link and keeps them in the URL", async () => {
  window.history.replaceState(
    null,
    "",
    "/kisumu?shock=20&budget=65&tab=facilities&day=41",
  );
  const scenario = fixtureScenario();
  render(<KisumuOverview panel={fixture.pilot} scenario={scenario} />);
  await vi.waitFor(() =>
    expect(scenario.submit).toHaveBeenCalledWith(20, expect.any(String)),
  );
  expect(
    screen
      .getByRole("tab", { name: /Facilities/ })
      .getAttribute("aria-selected"),
  ).toBe("true");
  expect(
    screen.getByRole("radio", { name: "20%" }).getAttribute("aria-checked"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("tab", { name: /Map and fixes/ }));
  expect(document.getElementById("readout")?.textContent).toMatch(
    /^Day 41 of 90/,
  );
  fireEvent.click(screen.getByRole("radio", { name: "100%" }));
  await vi.waitFor(() =>
    expect(window.location.search).toBe(
      "?shock=100&budget=65&tab=overview&day=41",
    ),
  );
});

it("follows a tab change in the URL and focuses that panel's heading", async () => {
  const { rerender } = render(
    <KisumuOverview panel={fixture.pilot} scenario={fixtureScenario()} />,
  );
  expect(
    screen
      .getByRole("tab", { name: "Map and fixes" })
      .getAttribute("aria-selected"),
  ).toBe("true");
  // A sidebar link changes only the query string; the page does not remount.
  window.history.pushState(null, "", "/kisumu?tab=facilities");
  rerender(
    <KisumuOverview panel={fixture.pilot} scenario={fixtureScenario()} />,
  );
  await vi.waitFor(() =>
    expect(document.activeElement?.id).toBe("facilities-heading"),
  );
  expect(
    screen
      .getByRole("tab", { name: /Facilities/ })
      .getAttribute("aria-selected"),
  ).toBe("true");
  // Back to a URL with no tab: the first tab again.
  window.history.pushState(null, "", "/kisumu");
  rerender(
    <KisumuOverview panel={fixture.pilot} scenario={fixtureScenario()} />,
  );
  await vi.waitFor(() =>
    expect(
      screen
        .getByRole("tab", { name: "Map and fixes" })
        .getAttribute("aria-selected"),
    ).toBe("true"),
  );
});

it("says when a facility has no stockout in the run", async () => {
  render(<KisumuOverview panel={fixture.pilot} scenario={fixtureScenario()} />);
  fireEvent.click(screen.getByRole("radio", { name: "0%" }));
  fireEvent.click(screen.getByRole("tab", { name: /Facilities/ }));
  const table = screen.getByRole("region", { name: "Facilities table" });
  await vi.waitFor(() =>
    expect(within(table).getAllByRole("row")[1].textContent).toMatch(
      /Critical/,
    ),
  );
  fireEvent.click(
    within(table).getByRole("button", { name: "Mvule Ridge Dispensary" }),
  );
  const detail = document.getElementById("facility-detail")!;
  await vi.waitFor(() =>
    expect(detail.textContent).toContain("No stockout in the 90-day run"),
  );
  fireEvent.click(
    within(table).getByRole("button", { name: "Acacia Ridge Dispensary" }),
  );
  await vi.waitFor(() =>
    expect(detail.textContent).toContain(
      "Out of stock at the start of the run",
    ),
  );
});

it("defines stockout and tracer where they are first used, once the run arrives", async () => {
  const pending = render(
    <KisumuOverview
      panel={fixture.pilot}
      scenario={{
        submit: vi.fn(() => new Promise<never>(() => {})),
        read: vi.fn(),
      }}
    />,
  );
  // Not in the dimmed loading state.
  expect(pending.container.querySelector("#verdict .terms")).toBeNull();
  pending.unmount();
  const { container } = render(
    <KisumuOverview panel={fixture.pilot} scenario={fixtureScenario()} />,
  );
  await vi.waitFor(() =>
    expect(container.querySelector("#verdict .terms")).not.toBeNull(),
  );
  expect(container.querySelector("#verdict .terms")?.textContent).toBe(
    "Stockout: one facility running out of one medicine. Tracer: a medicine tracked in this demo.",
  );
  expect(container.querySelectorAll("#verdict dfn")).toHaveLength(2);
});

it("says who the page is for and offers a next action under the verdict", async () => {
  const { container } = render(
    <KisumuOverview panel={fixture.pilot} scenario={fixtureScenario()} />,
  );
  expect(container.querySelector(".purpose")?.textContent).toBe(
    "For county health planners: rehearse which medicines run out first when donor logistics support is cut, and which fixes fit the budget.",
  );
  const verdict = await screen.findByRole("region", {
    name: "What breaks first",
  });
  const play = await within(verdict).findByRole("button", {
    name: "Play the timeline",
  });
  // Without a ranking service there is no budget to move.
  expect(
    within(verdict).queryByRole("button", { name: "Move the budget" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: /Facilities/ }));
  fireEvent.click(play);
  expect(
    screen
      .getByRole("tab", { name: "Map and fixes" })
      .getAttribute("aria-selected"),
  ).toBe("true");
  await vi.waitFor(() =>
    expect(document.getElementById("readout")?.textContent).toMatch(
      /^Day \d+ of 90/,
    ),
  );
  expect(container.querySelector(".verdict-facts")?.textContent).toBe(
    "211 stockouts = 209 caused by the shock + 2 already short before it10 Critical · 18 Watch · 12 Later",
  );
});
