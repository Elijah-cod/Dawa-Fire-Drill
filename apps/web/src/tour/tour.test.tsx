// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreferencesProvider } from "../preferences/preferences";
import {
  StartTourButton,
  TOUR_STEPS,
  TourProvider,
  tourNavigation,
  useTour,
} from "./tour";

const navigation = vi.hoisted(() => ({ pathname: "/", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push }),
}));

beforeEach(() => {
  navigation.pathname = "/";
  navigation.push.mockReset();
  window.history.replaceState(null, "", "/");
  window.sessionStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  // jsdom has no layout; give targets a size so the tour can see them.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    width: 100,
    height: 20,
    top: 0,
    left: 0,
    right: 100,
    bottom: 20,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
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
          <section>
            <h2 id="capture-title">Synthetic capture</h2>
          </section>
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

const nextEnabled = (name = "Next step") =>
  waitFor(() =>
    expect(
      (screen.getByRole("button", { name }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );

it("starts on the overview, moves focus to the caption and navigates to Kisumu", async () => {
  renderTour();
  fireEvent.click(
    screen.getByRole("button", { name: "Try the tour (about 3 minutes)" }),
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
    screen.queryByRole("button", { name: "Try the tour (about 3 minutes)" }),
  ).toBeNull();
  expect(
    screen.getByText(
      /starts here, on the national overview, and takes about 3 minutes/,
    ),
  ).toBeTruthy();
  await nextEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  expect(navigation.push).toHaveBeenCalledWith("/kisumu?tour=kisumu");
});

it("marks and scrolls to the current step's target", async () => {
  vi.useFakeTimers();
  try {
    renderTour();
    fireEvent.click(
      screen.getByRole("button", { name: "Try the tour (about 3 minutes)" }),
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

it("ends from the last step with Finish demo", async () => {
  navigation.pathname = "/kisumu";
  window.history.replaceState(null, "", "/kisumu?tour=capture");
  renderTour();
  await nextEnabled("Finish demo");
  fireEvent.click(screen.getByRole("button", { name: "Finish demo" }));
  expect(screen.getByTestId("step").textContent).toBe("none");
  expect(
    screen.getByRole("button", { name: "Try the tour (about 3 minutes)" }),
  ).toBeTruthy();
});

it("keeps the rest of the URL, such as the Kisumu tab, when the demo exits", () => {
  navigation.pathname = "/kisumu";
  window.history.replaceState(
    null,
    "",
    "/kisumu?tour=funding&shock=40&budget=30&tab=funding&day=45",
  );
  renderTour();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(window.location.search).toBe("?shock=40&budget=30&tab=funding&day=45");
});

it("keeps Next disabled until the step's target is visible", async () => {
  vi.mocked(Element.prototype.getBoundingClientRect).mockReturnValue({
    width: 0,
    height: 0,
  } as DOMRect);
  vi.useFakeTimers();
  try {
    renderTour();
    fireEvent.click(
      screen.getByRole("button", { name: "Try the tour (about 3 minutes)" }),
    );
    await act(async () => vi.advanceTimersByTime(1000));
    const next = screen.getByRole("button", {
      name: "Next step",
    }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe(
      "Waiting for this part of the page to appear…",
    );
    vi.mocked(Element.prototype.getBoundingClientRect).mockReturnValue({
      width: 100,
      height: 20,
    } as DOMRect);
    await act(async () => vi.advanceTimersByTime(300));
    expect(next.disabled).toBe(false);
    expect(
      screen.queryByText("Waiting for this part of the page to appear…"),
    ).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

it("returns to the view it was started from, shock, budget, tab and day included", async () => {
  const assign = vi.fn();
  const original = tourNavigation.assign;
  tourNavigation.assign = assign;
  try {
    navigation.pathname = "/kisumu";
    window.history.replaceState(
      null,
      "",
      "/kisumu?shock=20&budget=50&tab=facilities&day=10",
    );
    renderTour();
    fireEvent.click(
      screen.getByRole("button", { name: "Try the tour (about 3 minutes)" }),
    );
    const back = screen.getByRole("button", {
      name: "Back to where I started",
    });
    fireEvent.click(back);
    expect(assign).toHaveBeenCalledWith(
      "/kisumu?shock=20&budget=50&tab=facilities&day=10",
    );
    expect(screen.getByTestId("step").textContent).toBe("none");
  } finally {
    tourNavigation.assign = original;
  }
});

it("offers no way back when the tour starts on the overview itself", () => {
  renderTour();
  fireEvent.click(
    screen.getByRole("button", { name: "Try the tour (about 3 minutes)" }),
  );
  expect(
    screen.queryByRole("button", { name: "Back to where I started" }),
  ).toBeNull();
});
