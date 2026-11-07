// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NationalEntry } from "./national-entry";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("shows role switching only when enabled and hides the overview for facility scope", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/capabilities"))
        return Response.json({ role_switcher: true });
      if (url.endsWith("/session")) {
        const role = (init.headers as Headers).get("x-demo-role");
        return Response.json({
          role: role === "facility" ? "facility" : "planner",
          national_planning: role === "national",
          country_code: "KE",
          county_code: role === "facility" ? "042" : null,
          facility_id: role === "facility" ? "SYN-KE-042-F001" : null,
        });
      }
      return Response.json({ synthetic: true, notice: "Synthetic", items: [] });
    }),
  );
  render(<NationalEntry mode="demo" />);
  const switcher = await screen.findByLabelText(/demo role/i);
  expect(
    await screen.findByRole("heading", { name: /where would you act first/i }),
  ).toBeTruthy();
  fireEvent.change(switcher, { target: { value: "facility" } });
  expect(await screen.findByText(/do not have access/i)).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: /where would you act first/i }),
  ).toBeNull();
});

it("does not send a demo role when switching is disabled", async () => {
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    if (url.endsWith("/capabilities"))
      return Response.json({ role_switcher: false });
    if (url.endsWith("/session"))
      return Response.json({
        role: "planner",
        national_planning: true,
        country_code: "KE",
        county_code: null,
        facility_id: null,
      });
    expect((init.headers as Headers).get("x-demo-role")).toBeNull();
    return Response.json({ synthetic: true, notice: "Synthetic", items: [] });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<NationalEntry mode="demo" />);
  expect(
    await screen.findByRole("heading", { name: /where would you act first/i }),
  ).toBeTruthy();
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  expect(screen.queryByText(/county planning data is unavailable/i)).toBeNull();
  expect(screen.queryByLabelText(/demo role/i)).toBeNull();
});
