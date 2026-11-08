// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreferencesProvider } from "../preferences/preferences";
import { StartTourButton, TOUR_STEPS, TourProvider, useTour } from "./tour";

const navigation = vi.hoisted(() => ({ pathname: "/", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push }),
}));

beforeEach(() => {
  navigation.pathname = "/";
  navigation.push.mockReset();
  window.history.replaceState(null, "", "/");
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

function Step() {
  return <p data-testid="step">{useTour().step ?? "none"}</p>;
}
function renderTour() {
  return render(
    <PreferencesProvider>
      <TourProvider>
        <main>
          <h1>Synthetic overview</h1>
        </main>
        <StartTourButton />
        <Step />
      </TourProvider>
    </PreferencesProvider>,
  );
}

it("walks the seven demo steps in order", () => {
  expect(TOUR_STEPS.map((item) => item.id)).toEqual([
    "overview",
    "kisumu",
    "shock",
    "stockout",
    "funding",
    "rank",
    "capture",
  ]);
});

it("starts on the overview, moves focus to the caption and navigates to Kisumu", () => {
  renderTour();
  fireEvent.click(
    screen.getByRole("button", { name: "Try the 3-minute demo" }),
  );
  expect(screen.getByTestId("step").textContent).toBe("overview");
  expect(window.location.search).toBe("?tour=overview");
  const title = screen.getByRole("heading", { name: "National overview" });
  expect(document.activeElement).toBe(title);
  expect(screen.getByText(/Step 1 \/ 7/)).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Back" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    screen.queryByRole("button", { name: "Try the 3-minute demo" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  expect(navigation.push).toHaveBeenCalledWith("/kisumu?tour=kisumu");
});

it("marks and scrolls to the current step's target", async () => {
  vi.useFakeTimers();
  try {
    renderTour();
    fireEvent.click(
      screen.getByRole("button", { name: "Try the 3-minute demo" }),
    );
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    const heading = screen.getByRole("heading", { name: "Synthetic overview" });
    expect(heading.scrollIntoView).toHaveBeenCalled();
    expect(heading.getAttribute("data-tour-active")).toBe("true");
  } finally {
    vi.useRealTimers();
  }
});

it("resumes from the URL and lets the user go back, finish or exit with Escape", () => {
  navigation.pathname = "/kisumu";
  window.history.replaceState(null, "", "/kisumu?tour=capture");
  renderTour();
  expect(
    screen.getByRole("heading", { name: "Bin-card capture" }),
  ).toBeTruthy();
  expect(screen.getByText(/Step 7 \/ 7/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByTestId("step").textContent).toBe("rank");
  expect(window.location.search).toBe("?tour=rank");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.getByTestId("step").textContent).toBe("none");
  expect(window.location.search).toBe("");
  expect(screen.queryByRole("region", { name: /ranked fix/i })).toBeNull();
});

it("ends from the last step with Finish demo", () => {
  navigation.pathname = "/kisumu";
  window.history.replaceState(null, "", "/kisumu?tour=capture");
  renderTour();
  fireEvent.click(screen.getByRole("button", { name: "Finish demo" }));
  expect(screen.getByTestId("step").textContent).toBe("none");
  expect(
    screen.getByRole("button", { name: "Try the 3-minute demo" }),
  ).toBeTruthy();
});
