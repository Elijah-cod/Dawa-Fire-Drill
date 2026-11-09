// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import fixture from "../fixtures/kisumu.json";
import { withDisplayNames } from "../kisumu/names";
import { runEvents } from "../kisumu/view";
import { ORDER_PREVIEW, StockoutOrder } from "./stockout-order";
afterEach(cleanup);

const panel = withDisplayNames(fixture.pilot);
const events = runEvents({
  synthetic: true,
  county_code: "042",
  ...fixture.risk_runs["40"],
})!;

it("lists already-short facilities apart from the backend's shock-caused stockouts", () => {
  render(
    <StockoutOrder
      panel={panel}
      magnitude={40}
      total={events.all.length}
      shock={events.shock}
      alreadyShort={events.alreadyShort}
    />,
  );
  expect(
    screen.getByText("40% logistics cut: 211 stockouts in total."),
  ).toBeTruthy();
  const short = screen.getByRole("heading", {
    name: "Already short before the shock (2)",
  }).nextElementSibling as HTMLElement;
  expect(
    within(short)
      .getAllByRole("listitem")
      .map((li) => li.textContent),
  ).toEqual([
    "Acacia Ridge Dispensary (Kisumu Central) · antimalarial tracer 01 · from day 1",
    "Cedar Ridge Dispensary (Kisumu West) · antimalarial tracer 01 · from day 6",
  ]);
  expect(
    screen.getByRole("heading", { name: "Caused by the shock (209)" }),
  ).toBeTruthy();
  const lists = document.querySelectorAll("ol.order");
  expect(lists[1].children).toHaveLength(ORDER_PREVIEW);
  expect(lists[1].children[0].textContent).toBe(
    "Tamarind Crossing Sub-County Hospital (Kisumu West) · family planning tracer 04 · day 41",
  );
  // The rest sit behind "Show all", numbered on from the preview.
  expect(screen.getByText("Show all 209 (adds 11–209)")).toBeTruthy();
  expect(screen.getByText("Showing 1–10 of 209")).toBeTruthy();
  expect(lists[2].getAttribute("start")).toBe(String(ORDER_PREVIEW + 1));
  expect(lists[1].children.length + lists[2].children.length).toBe(209);
});

it("says plainly when nothing runs out because of the shock", () => {
  render(
    <StockoutOrder
      panel={panel}
      magnitude={0}
      total={2}
      shock={[]}
      alreadyShort={events.alreadyShort}
    />,
  );
  expect(screen.getByText("No shock: 2 stockouts in total.")).toBeTruthy();
  expect(
    screen.getByText("Nothing runs out because of the shock in this run."),
  ).toBeTruthy();
});

it("filters the order by area and medicine, with counts", () => {
  render(
    <StockoutOrder
      panel={panel}
      magnitude={40}
      total={events.all.length}
      shock={events.shock}
      alreadyShort={events.alreadyShort}
    />,
  );
  fireEvent.change(screen.getByLabelText("Sub-county"), {
    target: { value: "SYN-042-S03" },
  });
  fireEvent.change(screen.getByLabelText("Commodity"), {
    target: { value: "SYN-C04" },
  });
  const items = Array.from(document.querySelectorAll("ol.order li")).map(
    (li) => li.textContent,
  );
  expect(items.length).toBeGreaterThan(0);
  expect(
    items.every((text) =>
      /Kisumu West.*family planning tracer 04/.test(text ?? ""),
    ),
  ).toBe(true);
  expect(document.querySelector(".filter-count")?.textContent).toBe(
    `Showing ${items.length} of 211 stockouts.`,
  );
  fireEvent.change(screen.getByLabelText("Commodity"), {
    target: { value: "SYN-C09" },
  });
  fireEvent.change(screen.getByLabelText("Sub-county"), {
    target: { value: "SYN-042-S07" },
  });
  expect(document.body.textContent).toMatch(
    /No stockouts match these filters\.|Showing \d+ of 211/,
  );
});
