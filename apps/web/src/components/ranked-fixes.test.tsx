// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { createMockClient, MOCK_RUN_IDS } from "../api/mock-client";
import fixture from "../fixtures/kisumu.json";
import { withDisplayNames } from "../kisumu/names";
import {
  DEFAULT_BUDGET,
  RANK_DEBOUNCE_MS,
  snapBudget,
  useRanking,
  type Ranking,
} from "../kisumu/use-ranking";
import { coverage, runEvents } from "../kisumu/view";
import {
  PreferencesProvider,
  usePreferences,
} from "../preferences/preferences";
import { BudgetSentence } from "./kisumu-verdict";
import { RankedFixes } from "./ranked-fixes";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const panel = withDisplayNames(fixture.pilot);
const routes = fixture.pilot.demo_cases.transfer_routes;
const events = runEvents({
  synthetic: true,
  county_code: "042",
  ...fixture.risk_runs["40"],
})!.shock;
const runId = MOCK_RUN_IDS[40];
/** The recorded backend rankings (OR-Tools via rank_kisumu) behind the mock client. */
const recorded = (
  body: Parameters<ReturnType<typeof createMockClient>["rank"]>[1],
) => createMockClient("planner").rank(runId, body);

function Harness({
  rank = recorded,
  locale,
}: {
  rank?: typeof recorded;
  locale?: "sw";
}) {
  const ranking = useRanking({ runId, events, routes, rank });
  const { setLocale } = usePreferences();
  return (
    <>
      {locale && (
        <button type="button" onClick={() => setLocale(locale)}>
          locale
        </button>
      )}
      <p data-testid="sentence">
        <BudgetSentence
          panel={panel}
          ranking={ranking}
          onShowFunded={() => {}}
        />
      </p>
      <RankedFixes
        panel={panel}
        ranking={ranking}
        coverage={coverage(events, routes)}
      />
    </>
  );
}
const renderFixes = (props: Parameters<typeof Harness>[0] = {}) =>
  render(
    <PreferencesProvider>
      <Harness {...props} />
    </PreferencesProvider>,
  );
const status = () => document.getElementById("budget-status")!;

it("ranks at once at 30 units: three transfers funded, the fourth cut", async () => {
  renderFixes();
  await waitFor(() =>
    expect(status().textContent).toBe("30 of 30 units used."),
  );
  const pairs = screen
    .getAllByRole("listitem")
    .filter((li) => li.className === "pair");
  expect(pairs).toHaveLength(4);
  expect(within(pairs[0]).getByRole("heading").textContent).toBe(
    "Tamarind Crossing Sub-County Hospital: family planning tracer 04",
  );
  expect(pairs[0].querySelector(".meta")?.textContent).toBe(
    "Kisumu West · runs out on day 41 · if funded, either option keeps it stocked through day 90",
  );
  expect(pairs[0].querySelector(".option--funded")?.textContent).toMatch(
    /^Transferfrom .+, \d+(\.\d+)? km away10 unitsFunded$/,
  );
  expect(pairs[0].querySelector(".option--cut")?.textContent).toBe(
    "Emergency delivery50 unitsNot funded: Costs more than the whole budget",
  );
  expect(pairs[3].querySelector(".option--cut")?.textContent).toContain(
    "Not funded: Does not fit in what is left of the budget",
  );
  expect(document.querySelectorAll(".budget-bar .seg")).toHaveLength(3);
  expect(screen.getByTestId("sentence").textContent).toBe(
    "At 30 units (illustrative) the optimizer funds 3 transfers (30 units), each keeping its facility stocked through day 90. Jacaranda Ridge Sub-County Hospital (day 44) does not fit what is left.",
  );
  expect(
    screen.getByText(
      "These options address the 4 earliest of 209 shock-caused stockouts; the others have no option in this demo. OR-Tools picks what fits the budget. Costs are illustrative units, not calibrated to real prices.",
    ),
  ).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/KES/);
});

it("funds four at 100 units and none at 5, saying so plainly", async () => {
  renderFixes();
  await waitFor(() =>
    expect(status().textContent).toBe("30 of 30 units used."),
  );
  fireEvent.change(screen.getByLabelText("Budget (illustrative units)"), {
    target: { value: "100" },
  });
  await waitFor(() =>
    expect(status().textContent).toBe("40 of 100 units used."),
  );
  expect(document.querySelectorAll(".option--funded")).toHaveLength(4);
  expect(screen.getByTestId("sentence").textContent).toBe(
    "At 100 units (illustrative) the optimizer funds 4 transfers (40 units), each keeping its facility stocked through day 90.",
  );
  expect(document.querySelector(".pair .option--cut")?.textContent).toContain(
    "A cheaper option already covers this stockout",
  );
  fireEvent.change(screen.getByLabelText("Budget (illustrative units)"), {
    target: { value: "5" },
  });
  await waitFor(() =>
    expect(status().textContent).toBe(
      "Nothing fits 5 units. The cheapest fix costs 10 units.",
    ),
  );
  expect(document.querySelectorAll(".option--funded")).toHaveLength(0);
  expect(screen.getByTestId("sentence").textContent).toBe(
    "At 5 units (illustrative), nothing fits the budget; the cheapest fix costs 10 units.",
  );
  expect(document.querySelector(".explain-summary")?.textContent).toBe(
    "Nothing is funded: the cheapest option costs 10 units, more than the 5-unit budget.",
  );
});

it("summarizes the picks above a disclosure that holds the optimizer's own text", async () => {
  renderFixes();
  await waitFor(() =>
    expect(status().textContent).toBe("30 of 30 units used."),
  );
  const explain = document.querySelector(".explain")!;
  expect(explain.querySelector(".explain-summary")?.textContent).toBe(
    "Transfers and emergency deliveries give the same delay here, so the cheaper transfers are funded first.",
  );
  const details = explain.querySelector("details")!;
  expect(details.open).toBe(false);
  expect(details.querySelector("summary")?.textContent).toBe(
    "Why these picks?",
  );
  const text = details.querySelector('p[lang="en"]')!.textContent!;
  expect(text).toMatch(
    /^OR-Tools selected the transfer to Tamarind Crossing Sub-County Hospital \(family planning tracer 04\), /,
  );
  expect(text).not.toMatch(/Illustrative and unvalidated|transfer-\d/);
});

it("keeps the English-only note on the explanation in Swahili", async () => {
  renderFixes({ locale: "sw" });
  fireEvent.click(screen.getByRole("button", { name: "locale" }));
  await waitFor(() =>
    expect(status().textContent).toBe("Vipimo 30 kati ya 30 vimetumika."),
  );
  const details = document.querySelector(".explain details")!;
  expect(details.textContent).toContain(
    "Explanation available in English only.",
  );
  expect(details.querySelector('p[lang="en"]')?.textContent).toMatch(
    /^OR-Tools selected/,
  );
});

it("debounces budget changes, shows the last ranking meanwhile and ignores an older response", async () => {
  const resolvers: ((value: Ranking) => void)[] = [];
  const rank = vi.fn((body: Parameters<typeof recorded>[0]) =>
    body.budget === DEFAULT_BUDGET
      ? recorded(body)
      : new Promise<Ranking>((resolve) => resolvers.push(resolve)),
  );
  renderFixes({ rank });
  await waitFor(() =>
    expect(status().textContent).toBe("30 of 30 units used."),
  );
  vi.useFakeTimers();
  const slider = screen.getByLabelText("Budget (illustrative units)");
  fireEvent.change(slider, { target: { value: "35" } });
  fireEvent.change(slider, { target: { value: "40" } });
  expect(status().textContent).toBe(
    "Updating the ranking for 40 units… Showing 30 units until it arrives.",
  );
  expect(document.querySelectorAll(".option--funded")).toHaveLength(3);
  await act(async () => vi.advanceTimersByTime(RANK_DEBOUNCE_MS));
  expect(rank).toHaveBeenCalledTimes(2);
  expect(rank).toHaveBeenLastCalledWith(
    expect.objectContaining({ budget: 40 }),
  );
  fireEvent.change(slider, { target: { value: "100" } });
  await act(async () => vi.advanceTimersByTime(RANK_DEBOUNCE_MS));
  vi.useRealTimers();
  const ranked = (budget: string) =>
    recorded({ ...rank.mock.calls[0][0], budget: Number(budget) });
  // The 100-unit ranking arrives first; the older 40-unit one must not replace it.
  await act(async () => resolvers[1](await ranked("100")));
  await act(async () => resolvers[0](await ranked("40")));
  expect(status().textContent).toBe("40 of 100 units used.");
});

it("keeps the last ranking and offers a retry when a ranking fails", async () => {
  let fail = false;
  const rank = vi.fn((body: Parameters<typeof recorded>[0]) =>
    fail ? Promise.reject(new ApiError(500)) : recorded(body),
  );
  renderFixes({ rank });
  await waitFor(() =>
    expect(status().textContent).toBe("30 of 30 units used."),
  );
  fail = true;
  fireEvent.change(screen.getByLabelText("Budget (illustrative units)"), {
    target: { value: "100" },
  });
  const alert = await screen.findByRole("alert");
  expect(alert.id).toBe("budget-status");
  expect(alert.textContent).toContain(
    "The ranking for 100 units could not be updated. The fixes below are for 30 units, the last budget that ranked.",
  );
  expect(document.querySelectorAll(".option--funded")).toHaveLength(3);
  fail = false;
  fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
  await waitFor(() =>
    expect(status().textContent).toBe("40 of 100 units used."),
  );
});

it("asks for a connection while offline instead of ranking", async () => {
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  const rank = vi.fn(recorded);
  renderFixes({ rank });
  expect(status().textContent).toBe(
    "Offline. Go online to recalculate a ranking.",
  );
  expect(rank).not.toHaveBeenCalled();
  online.mockReturnValue(true);
  await act(async () => window.dispatchEvent(new Event("online")));
  await waitFor(() =>
    expect(status().textContent).toBe("30 of 30 units used."),
  );
  online.mockRestore();
});

it("commits the number field on blur and snaps to the 5-unit steps", async () => {
  const rank = vi.fn(recorded);
  renderFixes({ rank });
  await waitFor(() =>
    expect(status().textContent).toBe("30 of 30 units used."),
  );
  const field = screen.getByLabelText("Budget in illustrative units");
  fireEvent.change(field, { target: { value: "37" } });
  expect(rank).toHaveBeenCalledTimes(1);
  fireEvent.blur(field);
  await waitFor(() =>
    expect(status().textContent).toBe("30 of 35 units used."),
  );
  expect((field as HTMLInputElement).value).toBe("35");
  expect(snapBudget(500)).toBe(100);
  expect(snapBudget(-3)).toBe(0);
  expect(snapBudget(Number.NaN)).toBe(DEFAULT_BUDGET);
});

it("rejects an optimizer response for another run or unknown options", async () => {
  const { result } = renderHook(() =>
    useRanking({
      runId,
      events,
      routes,
      rank: async (body) => ({ ...(await recorded(body)), run_id: "other" }),
    }),
  );
  await waitFor(() => expect(result.current.status).toBe("error"));
  expect(result.current.result).toBeNull();
});

it("shows the budget disabled with the reason when nothing can be ranked", () => {
  const ranking = {
    budget: 30,
    rankedBudget: null,
    result: null,
    status: "idle" as const,
    fixes: [],
    candidates: [],
    setBudget: vi.fn(),
    retry: vi.fn(),
  };
  render(
    <RankedFixes
      panel={panel}
      ranking={ranking}
      coverage={null}
      noFix={{
        title: "No transfer can arrive in time at this shock.",
        text: "None of the 4 listed transfers can arrive in time.",
        budget:
          "The budget is not used at this shock: no transfer can arrive in time.",
      }}
    />,
  );
  const slider = screen.getByLabelText("Budget (illustrative units)");
  expect((slider as HTMLInputElement).disabled).toBe(true);
  expect(
    document.getElementById(slider.getAttribute("aria-describedby")!)
      ?.textContent,
  ).toBe(
    "The budget is not used at this shock: no transfer can arrive in time.",
  );
  expect(screen.getByRole("status").textContent).toContain(
    "No transfer can arrive in time at this shock.",
  );
});

it("starts from the budget a shared link asked for", async () => {
  const { result } = renderHook(() =>
    useRanking({ runId, events, routes, rank: recorded, initialBudget: 63 }),
  );
  expect(result.current.budget).toBe(65);
  await waitFor(() => expect(result.current.rankedBudget).toBe(65));
});
