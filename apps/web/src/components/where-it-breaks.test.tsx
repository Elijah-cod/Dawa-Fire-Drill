// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import fixture from "../fixtures/kisumu.json";
import { withDisplayNames } from "../kisumu/names";
import { risksForRun } from "../risk/risk";
import { outByDay, placeAreas, WhereItBreaks } from "./where-it-breaks";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const panel = withDisplayNames(fixture.pilot);
const run = fixture.risk_runs["40"];
const risks = risksForRun(panel, run);

function Harness({ start = 45 }: { start?: number }) {
  const [day, setDay] = useState(start);
  return (
    <WhereItBreaks
      panel={panel}
      events={run.stockouts}
      risks={risks}
      day={day}
      onDay={setDay}
    />
  );
}
const readout = () => document.getElementById("readout")!.textContent;

it.each([
  [0, 0, 0],
  [41, 3, 3],
  [90, 211, 40],
])(
  "counts stockouts and facilities out by day %i from the backend's stockout days",
  (day, soFar, out) => {
    expect(run.stockouts.filter((event) => event.day <= day)).toHaveLength(
      soFar,
    );
    expect(outByDay(run.stockouts, day).size).toBe(out);
    render(<Harness start={day} />);
    expect(readout()).toBe(
      `Day ${day} of 90: ${soFar} of 211 stockouts so far, ${out} of 40 facilities out of at least one commodity. Modeled, no intervention.`,
    );
  },
);

it("steps a week at a time, stops at the ends and follows the day slider", () => {
  render(<Harness start={84} />);
  fireEvent.click(screen.getByRole("button", { name: "Forward one week" }));
  expect(readout()).toMatch(/^Day 90 of 90/);
  expect(
    (
      screen.getByRole("button", {
        name: "Forward one week",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Back one week" }));
  expect(readout()).toMatch(/^Day 83 of 90/);
  fireEvent.change(screen.getByLabelText("Day of the 90-day run"), {
    target: { value: "41" },
  });
  expect(readout()).toMatch(/^Day 41 of 90: 3 of 211/);
  expect(screen.getByText(/^Kisumu West: 2 of 6 out by day 41$/)).toBeTruthy();
});

it("plays only when asked, keeps the readout quiet while playing and stops at day 90", async () => {
  vi.useFakeTimers();
  render(<Harness start={88} />);
  expect(document.getElementById("readout")!.getAttribute("aria-live")).toBe(
    "polite",
  );
  fireEvent.click(screen.getByRole("button", { name: "Play the run" }));
  expect(document.getElementById("readout")!.getAttribute("aria-live")).toBe(
    "off",
  );
  await act(async () => vi.advanceTimersByTime(120 * 3));
  expect(readout()).toMatch(/^Day 90 of 90/);
  expect(screen.getByRole("button", { name: "Play the run" })).toBeTruthy();
});

it("replaces play with week steps under reduced motion", () => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes("reduce"),
  })) as typeof window.matchMedia;
  render(<Harness />);
  expect(screen.queryByRole("button", { name: "Play the run" })).toBeNull();
  expect(screen.getByRole("button", { name: "Back one week" })).toBeTruthy();
  window.matchMedia = original;
});

it("places every area inside the map with no two markers overlapping", () => {
  const areas = panel.subcounties.map((subcounty) => {
    const facilities = panel.facilities.filter(
      (f) => f.subcounty_id === subcounty.id,
    );
    return {
      id: subcounty.id,
      name: subcounty.name,
      facilities,
      lon: facilities.reduce((s, f) => s + f.longitude!, 0) / facilities.length,
      lat: facilities.reduce((s, f) => s + f.latitude!, 0) / facilities.length,
    };
  });
  for (const [width, height] of [
    [326, 232],
    [600, 292],
  ]) {
    const placed = placeAreas(areas, width, height);
    expect(placed).toHaveLength(7);
    for (const p of placed) {
      expect(p.x - 30).toBeGreaterThanOrEqual(0);
      expect(p.x + 30).toBeLessThanOrEqual(width);
      expect(p.y - 24).toBeGreaterThanOrEqual(0);
      expect(p.y + 24).toBeLessThanOrEqual(height);
    }
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++)
        expect(
          Math.abs(placed[i].x - placed[j].x) >= 60 ||
            Math.abs(placed[i].y - placed[j].y) >= 48,
        ).toBe(true);
  }
});

it("shows a loading state, not zero counts, while the run loads", () => {
  const { rerender } = render(
    <WhereItBreaks
      panel={panel}
      events={[]}
      risks={{}}
      day={45}
      onDay={() => {}}
      loading
    />,
  );
  expect(readout()).toBe("Loading the run…");
  expect(readout()).not.toMatch(/0 of 0/);
  expect(document.querySelector(".map-panel")?.getAttribute("aria-busy")).toBe(
    "true",
  );
  expect(screen.getByText(/^Kisumu West: 6 facilities$/)).toBeTruthy();
  expect(document.querySelector(".areas .mix")).toBeNull();
  rerender(
    <WhereItBreaks
      panel={panel}
      events={run.stockouts}
      risks={risks}
      day={45}
      onDay={() => {}}
    />,
  );
  expect(readout()).toMatch(/^Day 45 of 90: 11 of 211 stockouts so far/);
});
