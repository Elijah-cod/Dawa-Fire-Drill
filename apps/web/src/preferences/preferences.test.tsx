// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  PreferencesProvider,
  PreferenceControls,
  usePreferences,
} from "./preferences";
import { AppShell } from "../components/app-shell";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(cleanup);

function ReadCopy() {
  const { t } = usePreferences();
  return <p>{t("overviewTitle")}</p>;
}

it("switches the language and dark theme", async () => {
  render(
    <PreferencesProvider>
      <PreferenceControls />
      <ReadCopy />
    </PreferencesProvider>,
  );
  fireEvent.change(screen.getByLabelText(/language/i), {
    target: { value: "sw" },
  });
  expect(screen.getByText("Ungechukua hatua wapi kwanza?")).toBeTruthy();
  await waitFor(() => expect(document.documentElement.lang).toBe("sw"));
  fireEvent.change(screen.getByLabelText(/theme/i), {
    target: { value: "dark" },
  });
  await waitFor(() =>
    expect(document.documentElement.dataset.theme).toBe("dark"),
  );
});

it("keeps the synthetic notice visible after switching language", () => {
  render(
    <PreferencesProvider>
      <AppShell>
        <p>Test</p>
      </AppShell>
    </PreferencesProvider>,
  );
  expect(screen.getByRole("note").textContent).toContain(
    "Facilities, names, locations and costs are invented.",
  );
  const about = screen.getByRole("button", { name: "About this demo" });
  expect(about.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(about);
  expect(about.getAttribute("aria-expanded")).toBe("true");
  expect(document.getElementById("about-demo")?.textContent).toContain(
    "Only some scale parameters (facility mix, lead times, demand and funding totals) are anchored to public aggregates",
  );
  fireEvent.change(screen.getByLabelText(/language/i), {
    target: { value: "sw" },
  });
  expect(screen.getByRole("note").textContent).toContain(
    "Vituo, majina, maeneo na gharama ni vya kubuni.",
  );
});
