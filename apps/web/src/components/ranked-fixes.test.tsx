// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RankedFixes } from "./ranked-fixes";

afterEach(cleanup);

it("shows optimizer order, the budget cut line, reasons and the first-stockout target", async () => {
  const rank = vi.fn(async () => ({
    synthetic: true,
    notice: "Illustrative and unvalidated",
    run_id: "run-1",
    selected_ids: ["first-cheap"],
    selected_reasons: { "first-cheap": "included_in_optimal_set" },
    excluded_reasons: { "first-costly": "alternative_selected" },
    cut_line: 1,
    total_cost: 10,
    remaining_budget: 90,
    minimum_benefit: 1,
    effects: [
      {
        id: "first-cheap",
        baseline_stockout_day: 48,
        counterfactual_stockout_day: null,
        deferred_days: 42,
      },
    ],
    explanation: "The optimizer selected first-cheap.",
  }));
  render(
    <RankedFixes
      runId="run-1"
      target={{ facility_id: "F001", commodity_id: "C02", day: 48 }}
      rank={rank}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: /rank feasible actions/i }),
  );
  expect(
    await screen.findByText(/The optimizer selected first-cheap/),
  ).toBeTruthy();
  expect(screen.getByText(/F001.*C02.*48/)).toBeTruthy();
  expect(screen.getByText(/cut line/i)).toBeTruthy();
  expect(screen.getByText(/42 modeled days deferred/i)).toBeTruthy();
  expect(
    screen.getByText(/another option for this stockout was selected/i),
  ).toBeTruthy();
  expect(
    screen.getByText(/costs and benefits are illustrative assumptions/i),
  ).toBeTruthy();
  expect(rank).toHaveBeenCalledWith(
    expect.objectContaining({ budget: 100, minimum_benefit: 1 }),
  );
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
      target={{ facility_id: "F001", commodity_id: "C02", day: 48 }}
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
    selected_ids: ["first-cheap"],
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
      target={{ facility_id: "F001", commodity_id: "C02", day: 48 }}
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
        target={{ facility_id: "F001", commodity_id: "C02", day: 48 }}
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
