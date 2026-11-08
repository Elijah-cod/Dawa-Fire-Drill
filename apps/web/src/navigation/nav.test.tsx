// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PreferencesProvider } from "../preferences/preferences";
import { PrimaryNav } from "./nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/kisumu" }));
afterEach(cleanup);

it("links to the overview, Kisumu, funding trace and bin-card capture", () => {
  render(
    <PreferencesProvider>
      <PrimaryNav label="Primary" />
    </PreferencesProvider>,
  );
  const nav = screen.getByRole("navigation", { name: "Primary" });
  const links = within(nav).getAllByRole("link");
  expect(
    links.map((link) => [link.textContent, link.getAttribute("href")]),
  ).toEqual([
    ["Overview", "/"],
    ["Kisumu", "/kisumu"],
    ["Funding trace", "/kisumu#funding-title"],
    ["Bin-card capture", "/kisumu?view=capture#capture-title"],
  ]);
  expect(
    links.filter((link) => link.getAttribute("aria-current") === "page"),
  ).toEqual([links[1]]);
});
