// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { peakWindow, StockoutOrder } from "./stockout-order";
afterEach(cleanup);

const events = [
  { facility_id: "F031", commodity_id: "C04", day: 41 },
  { facility_id: "F019", commodity_id: "C03", day: 43 },
  { facility_id: "F004", commodity_id: "C04", day: 72 },
  { facility_id: "F005", commodity_id: "C01", day: 74 },
  { facility_id: "F006", commodity_id: "C02", day: 76 },
  { facility_id: "F007", commodity_id: "C02", day: 80 },
];

it("summarizes counts against no shock, the first stockout and the busiest week", () => {
  render(
    <StockoutOrder events={events} magnitude={40} total={8} noShock={2} />,
  );
  expect(document.querySelector(".stockout-summary")?.textContent).toBe(
    "40% shock: 8 stockouts vs 2 with no shock · 6 caused by the shock. First: F031 · C04 on day 41. Most: days 71–77 (3).",
  );
  expect(screen.queryByText(/same day/i)).toBeNull();
});

it("keeps the full order behind a disclosure", async () => {
  render(<StockoutOrder events={events} magnitude={40} />);
  expect(screen.queryByText(/F007 · C02/)).toBeNull();
  const details = screen
    .getByText("Show all 6 shock-caused stockouts in order")
    .closest("details")!;
  expect(details.open).toBe(false);
  fireEvent.click(screen.getByText(/show all 6/i));
  const items = await within(details).findAllByRole("listitem");
  expect(items.map((item) => item.textContent)).toEqual(
    events.map(
      (e) => `${e.facility_id} · ${e.commodity_id} · ${e.day} days to stockout`,
    ),
  );
});

it("omits the comparison when no-shock counts are unavailable", () => {
  render(<StockoutOrder events={events.slice(0, 1)} magnitude={25} />);
  expect(document.querySelector(".stockout-summary")?.textContent).toBe(
    "25% shock: 1 caused by the shock. First: F031 · C04 on day 41. Most: days 36–42 (1).",
  );
});

it("picks the earliest of equally busy weeks", () => {
  expect(
    peakWindow([
      { facility_id: "A", commodity_id: "C", day: 15 },
      { facility_id: "B", commodity_id: "C", day: 1 },
    ]),
  ).toEqual({ start: 1, end: 7, count: 1 });
  expect(peakWindow([])).toBeNull();
});
