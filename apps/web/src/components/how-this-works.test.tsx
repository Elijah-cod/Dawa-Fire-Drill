// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { HowThisWorks } from "./how-this-works";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

it("states what the model compares, replays and does not model", () => {
  render(
    <HowThisWorks
      coverage={{ count: 4, total: 209, earliest: true, first: 41, last: 44 }}
      shockStockouts={209}
    />,
  );
  const text = document.getElementById("how-this-works")!.textContent!;
  expect(text).toContain(
    "A stockout is shock-caused when that facility and medicine does not run out in the no-shock run, or runs out earlier under the shock.",
  );
  expect(text).toContain(
    "Each option is replayed on its own, for one facility and one medicine",
  );
  expect(text).toContain(
    "transfers of the same medicine from the same donor share a conservative pool",
  );
  expect(text).toContain(
    "different medicines from the same donor are separate pools",
  );
  expect(text).toContain("knock-on stockouts are not shown");
  expect(text).toContain(
    "the budget changes which fixes are funded, not the map",
  );
  expect(text).toContain(
    "Only 4 of 209 shock-caused stockouts in the shown run have options in this demo.",
  );
});

it("keeps the coverage statement true when no option can arrive in time or there is no shock", () => {
  const { rerender } = render(
    <HowThisWorks coverage={null} shockStockouts={393} />,
  );
  expect(document.getElementById("how-this-works")!.textContent).toContain(
    "None of the 393 shock-caused stockouts in the shown run has an option that can arrive in time.",
  );
  rerender(<HowThisWorks coverage={null} shockStockouts={0} />);
  expect(document.getElementById("how-this-works")!.textContent).toContain(
    "With no shock there are no shock-caused stockouts to fix.",
  );
});

it("opens when the URL points at it, as the About panel link does", () => {
  window.history.replaceState(null, "", "/kisumu#how-this-works");
  render(<HowThisWorks coverage={null} shockStockouts={0} />);
  const details = document.getElementById(
    "how-this-works",
  ) as HTMLDetailsElement;
  expect(details.open).toBe(true);
  expect(screen.getByText("How this works").tagName).toBe("SUMMARY");
});
