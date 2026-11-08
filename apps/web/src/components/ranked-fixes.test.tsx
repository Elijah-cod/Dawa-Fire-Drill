// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RankedFixes } from "./ranked-fixes";

afterEach(cleanup);

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

it("shows optimizer order, the budget cut line, reasons and the first-stockout target", async () => {
  const rank = vi.fn(async () => ({
    synthetic: true,
    notice: "Illustrative and unvalidated",
    run_id: "run-1",
    selected_ids: ["transfer-1"],
    selected_reasons: { "transfer-1": "included_in_optimal_set" },
    excluded_reasons: { "emergency-1": "alternative_selected" },
    cut_line: 1,
    total_cost: 10,
    remaining_budget: 90,
    minimum_benefit: 1,
    effects: [
      {
        id: "transfer-1",
        baseline_stockout_day: 48,
        counterfactual_stockout_day: null,
        deferred_days: 42,
      },
    ],
    explanation: "The optimizer selected transfer.",
  }));
  render(
    <RankedFixes
      runId="run-1"
      events={[{ facility_id: "F001", commodity_id: "C02", day: 48 }]}
      routes={[route]}
      rank={rank}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: /rank feasible actions/i }),
  );
  expect(
    await screen.findByText(/The optimizer selected transfer/),
  ).toBeTruthy();
  expect(
    screen.getByText(/Earliest shock-caused stockouts.*F001 · C02 · 48/),
  ).toBeTruthy();
  expect((rank.mock.calls as unknown[][])[0][0]).not.toHaveProperty(
    "minimum_benefit",
  );
  expect(screen.getByText(/cut line/i)).toBeTruthy();
  expect(screen.getByText(/42 modeled days deferred/i)).toBeTruthy();
  expect(
    screen.getByText(/another option for this stockout was selected/i),
  ).toBeTruthy();
  expect(
    screen.getByText(/costs and benefits are illustrative assumptions/i),
  ).toBeTruthy();
  expect(rank).toHaveBeenCalledWith(expect.objectContaining({ budget: 30 }));
});

it("reports when the synthetic protection target cannot fit the ceiling", async () => {
  const { ApiError } = await import("../api/client");
  const rank = vi
    .fn()
    .mockRejectedValue(
      new ApiError(409, "Benefit target cannot be met within the budget"),
    );
  render(
    <RankedFixes
      runId="run-1"
      events={[{ facility_id: "F001", commodity_id: "C02", day: 48 }]}
      routes={[route]}
      rank={rank}
    />,
  );
  fireEvent.change(screen.getByLabelText(/budget ceiling/i), {
    target: { value: "1" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: /rank feasible actions/i }),
  );
  expect(
    await screen.findByText(
      /no supplied option meets this synthetic target within the budget/i,
    ),
  ).toBeTruthy();
});

it("re-ranks after the ceiling changes and ignores an older response", async () => {
  let finishOld: (
    value: import("../generated/api").components["schemas"]["ModeledResponse"],
  ) => void = () => {};
  const result = {
    synthetic: true,
    notice: "Illustrative",
    run_id: "run-1",
    selected_ids: ["transfer-1"],
    selected_reasons: {},
    excluded_reasons: {},
    cut_line: 1,
    total_cost: 10,
    remaining_budget: 90,
    minimum_benefit: 1,
    effects: [],
    explanation: "Old budget result",
  };
  const rank = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    )
    .mockResolvedValue({
      ...result,
      remaining_budget: 40,
      explanation: "New budget result",
    });
  render(
    <RankedFixes
      runId="run-1"
      events={[{ facility_id: "F001", commodity_id: "C02", day: 48 }]}
      routes={[route]}
      rank={rank}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: /rank feasible actions/i }),
  );
  fireEvent.change(screen.getByLabelText(/budget ceiling/i), {
    target: { value: "50" },
  });
  expect(await screen.findByText("New budget result")).toBeTruthy();
  finishOld(result);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(screen.queryByText("Old budget result")).toBeNull();
  expect(rank).toHaveBeenLastCalledWith(
    expect.objectContaining({ budget: 50 }),
  );
});

it("explains that a new ranking requires a connection while offline", () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "onLine");
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  const rank = vi.fn();
  try {
    render(
      <RankedFixes
        runId="run-1"
        events={[{ facility_id: "F001", commodity_id: "C02", day: 48 }]}
        routes={[route]}
        rank={rank}
      />,
    );
    expect(screen.getByText(/go online to recalculate/i)).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: /rank feasible actions/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(rank).not.toHaveBeenCalled();
  } finally {
    if (original) Object.defineProperty(navigator, "onLine", original);
    else Reflect.deleteProperty(navigator, "onLine");
  }
});

it("compares the planted transfer and emergency for the first event", async () => {
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
  const rank = vi.fn(async () => ({
    synthetic: true,
    notice: "Illustrative",
    run_id: "run-1",
    selected_ids: ["transfer-1"],
    selected_reasons: { "transfer-1": "included_in_optimal_set" },
    excluded_reasons: { "emergency-1": "alternative_selected" },
    cut_line: 1,
    total_cost: 10,
    remaining_budget: 90,
    minimum_benefit: 1,
    effects: [],
    explanation: "OR-Tools selected transfer.",
  }));
  render(
    <RankedFixes
      runId="run-1"
      events={[{ facility_id: "F001", commodity_id: "C02", day: 48 }]}
      routes={[route]}
      rank={rank}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: /rank feasible actions/i }),
  );
  expect(await screen.findByText(/OR-Tools selected transfer/)).toBeTruthy();
  expect(
    screen.getByText(/Emergency delivery.*50 KES.*another option/i),
  ).toBeTruthy();
  expect(screen.getByText(/Redistribution transfer.*10 KES/i)).toBeTruthy();
  expect(rank).toHaveBeenCalledWith(
    expect.objectContaining({
      candidates: expect.arrayContaining([
        expect.objectContaining({
          id: "transfer-1",
          kind: "redistribution",
          donor_facility_id: "F002",
        }),
        expect.objectContaining({
          id: "emergency-1",
          kind: "emergency_procurement",
        }),
      ]),
    }),
  );
});

it("labels the optimizer explanation as English-only in Swahili", async () => {
  const { PreferenceControls, PreferencesProvider } =
    await import("../preferences/preferences");
  const rank = vi.fn().mockResolvedValue({
    synthetic: true,
    notice: "Illustrative",
    run_id: "run-1",
    selected_ids: ["transfer-1"],
    selected_reasons: {},
    excluded_reasons: { "emergency-1": "alternative_selected" },
    cut_line: 1,
    total_cost: 10,
    remaining_budget: 90,
    minimum_benefit: 1,
    effects: [],
    explanation: "OR-Tools selected transfer.",
  });
  render(
    <PreferencesProvider>
      <PreferenceControls />
      <RankedFixes
        runId="run-1"
        events={[{ facility_id: "F001", commodity_id: "C02", day: 48 }]}
        routes={[route]}
        rank={rank}
      />
    </PreferencesProvider>,
  );
  fireEvent.change(screen.getByLabelText(/Language \/ Lugha/i), {
    target: { value: "sw" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: /Panga hatua zinazowezekana/i }),
  );
  expect(
    await screen.findByText(/Explanation available in English only/i),
  ).toBeTruthy();
  expect(
    screen.getByText("OR-Tools selected transfer.").getAttribute("lang"),
  ).toBe("en");
});

it("refuses a transfer that targets a different first stockout", () => {
  const rank = vi.fn();
  render(
    <RankedFixes
      runId="run-1"
      events={[{ facility_id: "F001", commodity_id: "C02", day: 48 }]}
      routes={[{ ...route, facility_id: "F003" }]}
      rank={rank}
    />,
  );
  expect(screen.getByText(/no planted transfer matches/i)).toBeTruthy();
  expect(
    (
      screen.getByRole("button", {
        name: /rank feasible actions/i,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});

it("lists each candidate with cost, deferral and status on either side of the cut line", async () => {
  const rank = vi.fn(async () => ({
    synthetic: true,
    notice: "Illustrative",
    run_id: "run-1",
    selected_ids: ["transfer-1"],
    selected_reasons: { "transfer-1": "included_in_optimal_set" },
    excluded_reasons: { "emergency-1": "alternative_selected" },
    cut_line: 1,
    total_cost: 10,
    remaining_budget: 90,
    minimum_benefit: 1,
    effects: [
      {
        id: "transfer-1",
        baseline_stockout_day: 48,
        counterfactual_stockout_day: null,
        deferred_days: 43,
      },
      {
        id: "emergency-1",
        baseline_stockout_day: 48,
        counterfactual_stockout_day: null,
        deferred_days: 41,
      },
    ],
    explanation: "OR-Tools selected transfer.",
  }));
  render(
    <RankedFixes
      runId="run-1"
      events={[{ facility_id: "F001", commodity_id: "C02", day: 48 }]}
      routes={[route]}
      rank={rank}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: /rank feasible actions/i }),
  );
  await screen.findByText(/OR-Tools selected transfer/);
  const above = screen.getByRole("list", {
    name: /selected within the budget/i,
  });
  const below = screen.getByRole("list", { name: /not selected/i });
  const cut = screen.getByText(/budget cut line/i);
  expect(above.textContent).toMatch(
    /Redistribution transfer → F001 · C02 · 10 KES · 43 modeled days deferred · Selected by the optimizer/,
  );
  expect(below.textContent).toMatch(
    /Emergency delivery → F001 · C02 · 50 KES · 41 modeled days deferred · Another option for this stockout was selected/,
  );
  expect(
    above.compareDocumentPosition(cut) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    cut.compareDocumentPosition(below) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(screen.getAllByText(/illustrative assumption\b/i)).toHaveLength(1);
});

it("marks a missing modeled deferral instead of inventing one", async () => {
  const rank = vi.fn(async () => ({
    synthetic: true,
    notice: "Illustrative",
    run_id: "run-1",
    selected_ids: ["transfer-1"],
    selected_reasons: {},
    excluded_reasons: {},
    cut_line: 1,
    total_cost: 10,
    remaining_budget: 90,
    minimum_benefit: 1,
    effects: [],
    explanation: null,
  }));
  render(
    <RankedFixes
      runId="run-1"
      events={[{ facility_id: "F001", commodity_id: "C02", day: 48 }]}
      routes={[route]}
      rank={rank}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: /rank feasible actions/i }),
  );
  const below = await screen.findByRole("list", { name: /not selected/i });
  expect(below.textContent).toMatch(
    /Emergency delivery → F001 · C02 · 50 KES · modeled deferral unavailable · The exclusion reason is unavailable/,
  );
});

it("funds what fits the ceiling and names the budget for the rest", async () => {
  const second = { ...route, facility_id: "F019", commodity_id: "C03" };
  const rank = vi.fn(async () => ({
    synthetic: true,
    notice: "Illustrative",
    run_id: "run-1",
    selected_ids: ["transfer-1"],
    selected_reasons: { "transfer-1": "included_in_optimal_set" },
    excluded_reasons: {
      "emergency-1": "cost_exceeds_ceiling",
      "transfer-2": "remaining_budget_exceeded",
      "emergency-2": "cost_exceeds_ceiling",
    },
    cut_line: 1,
    total_cost: 10,
    remaining_budget: 5,
    minimum_benefit: null,
    effects: [],
    explanation: "OR-Tools selected transfer-1.",
  }));
  render(
    <RankedFixes
      runId="run-1"
      events={[
        { facility_id: "F001", commodity_id: "C02", day: 48 },
        { facility_id: "F019", commodity_id: "C03", day: 50 },
      ]}
      routes={[route, second]}
      rank={rank}
    />,
  );
  fireEvent.change(screen.getByLabelText(/budget ceiling/i), {
    target: { value: "15" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: /rank feasible actions/i }),
  );
  const below = await screen.findByRole("list", { name: /not selected/i });
  expect(below.textContent).toMatch(
    /Redistribution transfer → F019 · C03 · 10 KES · modeled deferral unavailable · Not funded: it does not fit in the remaining budget\./,
  );
  expect(below.textContent).toMatch(
    /Emergency delivery → F001 · C02 · 50 KES · modeled deferral unavailable · The assumed cost exceeds the ceiling\./,
  );
  expect(
    screen.getByText(
      /Earliest shock-caused stockouts.*F001 · C02 · 48 .*; F019 · C03 · 50/,
    ),
  ).toBeTruthy();
  expect((rank.mock.calls as unknown[][])[0][0]).toMatchObject({
    budget: 15,
    candidates: expect.arrayContaining([
      expect.objectContaining({ id: "transfer-2", facility_id: "F019" }),
    ]),
  });
});
