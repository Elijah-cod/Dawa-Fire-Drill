// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NationalOverview } from "./national-overview";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("selects a county and identifies planning-only access", async () => {
  const load = async () => ({
    synthetic: true,
    notice: "Synthetic",
    items: [
      {
        county_code: "047",
        county_name: "Nairobi",
        planning: { approved: 100, released: 40 },
      },
    ],
  });
  render(<NationalOverview loadOverview={load} />);
  fireEvent.click(await screen.findByRole("button", { name: /Nairobi.*047/i }));
  expect(screen.getByRole("heading", { name: /Nairobi.*047/i })).toBeTruthy();
  expect(screen.getByText(/planning overview only/i)).toBeTruthy();
  expect(await screen.findByText(/100/)).toBeTruthy();
});

it("shows partial inputs without treating missing data as zero", async () => {
  const load = async () => ({
    synthetic: true,
    notice: "Synthetic",
    items: [{ county_code: "047", county_name: "Nairobi", planning: null }],
  });
  render(<NationalOverview loadOverview={load} />);
  expect(
    await screen.findByText(/some county planning inputs are unavailable/i),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Nairobi.*047/i }));
  expect(screen.getByText(/county planning data is unavailable/i)).toBeTruthy();
});

it("offers a retry when the overview cannot be loaded", async () => {
  render(
    <NationalOverview
      loadOverview={async () => {
        throw new Error("offline");
      }}
    />,
  );
  expect(
    await screen.findByText(/county planning data is unavailable/i),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
});

it("identifies offline mode while retaining the county list", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  render(
    <NationalOverview
      loadOverview={async () => {
        throw new Error("offline");
      }}
    />,
  );
  expect(await screen.findByText(/offline/i)).toBeTruthy();
  expect(screen.getByRole("button", { name: /Kisumu.*042/i })).toBeTruthy();
});
