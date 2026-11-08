// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { StockoutOrder } from "./stockout-order";
afterEach(cleanup);
it("shows the first stockouts and retains the remaining order in a disclosure", async () => {
  const events = Array.from({ length: 7 }, (_, i) => ({
    facility_id: `F${i}`,
    commodity_id: "C1",
    day: i,
  }));
  render(<StockoutOrder events={events} />);
  expect(screen.getByText(/F0.*C1/)).toBeTruthy();
  const details = screen
    .getByText(/show remaining 2 stockouts/i)
    .closest("details");
  expect(details?.open).toBe(false);
  expect(screen.queryByText(/F6.*C1/)).toBeNull();
  fireEvent.click(screen.getByText(/show remaining 2 stockouts/i));
  expect(await within(details!).findByText(/F6.*C1/)).toBeTruthy();
});

it("lists other commodities at the first facility that run out on the same day", () => {
  render(
    <StockoutOrder
      events={[
        { facility_id: "F001", commodity_id: "C02", day: 48 },
        { facility_id: "F001", commodity_id: "C03", day: 48 },
        { facility_id: "F002", commodity_id: "C02", day: 48 },
        { facility_id: "F001", commodity_id: "C04", day: 48 },
        { facility_id: "F001", commodity_id: "C05", day: 50 },
      ]}
    />,
  );
  expect(
    screen.getByText(/same day at F001 · 48 days to stockout: C03, C04$/i),
  ).toBeTruthy();
});

it("omits the same-day line when the first stockout stands alone", () => {
  render(
    <StockoutOrder
      events={[
        { facility_id: "F001", commodity_id: "C02", day: 48 },
        { facility_id: "F001", commodity_id: "C03", day: 49 },
      ]}
    />,
  );
  expect(screen.queryByText(/same day/i)).toBeNull();
});
