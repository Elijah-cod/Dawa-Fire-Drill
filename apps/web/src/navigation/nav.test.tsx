// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PreferencesProvider } from "../preferences/preferences";
import { activeNavKey, PrimaryNav } from "./nav";

const location = vi.hoisted(() => ({ pathname: "/kisumu", search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => location.pathname,
  useSearchParams: () => new URLSearchParams(location.search),
}));
afterEach(cleanup);

const renderNav = (pathname: string, search = "") => {
  location.pathname = pathname;
  location.search = search;
  render(
    <PreferencesProvider>
      <PrimaryNav label="Primary" />
    </PreferencesProvider>,
  );
  return within(
    screen.getByRole("navigation", { name: "Primary" }),
  ).getAllByRole("link");
};

it("links to the overview, Kisumu, the funding tab and bin-card capture", () => {
  const links = renderNav("/kisumu");
  expect(
    links.map((link) => [link.textContent, link.getAttribute("href")]),
  ).toEqual([
    ["Overview", "/"],
    ["Kisumu", "/kisumu"],
    ["Funding trace", "/kisumu?tab=funding"],
    ["Bin-card capture", "/kisumu?view=capture#capture-title"],
  ]);
});

it.each([
  ["/", "", "Overview"],
  ["/kisumu", "", "Kisumu"],
  ["/kisumu", "?shock=40&budget=30&tab=overview&day=45", "Kisumu"],
  ["/kisumu", "?shock=40&budget=30&tab=funding&day=45", "Funding trace"],
  ["/kisumu", "?view=capture", "Bin-card capture"],
])("marks exactly one link current for %s%s", (pathname, search, name) => {
  const links = renderNav(pathname, search);
  const current = links.filter(
    (link) => link.getAttribute("aria-current") === "page",
  );
  expect(current.map((link) => link.textContent)).toEqual([name]);
});

describe("activeNavKey", () => {
  const key = (pathname: string, search = "") =>
    activeNavKey(pathname, new URLSearchParams(search));
  it("follows the page, then the capture view, then the funding tab", () => {
    expect(key("/")).toBe("overview");
    expect(key("/kisumu")).toBe("navKisumu");
    expect(key("/kisumu", "?tab=facilities")).toBe("navKisumu");
    expect(key("/kisumu", "?tab=funding")).toBe("navFunding");
    expect(key("/kisumu", "?view=capture&tab=funding")).toBe("navCapture");
  });
  it("follows the guided demo's funding and capture steps", () => {
    expect(key("/kisumu", "?tour=funding")).toBe("navFunding");
    expect(key("/kisumu", "?tour=capture")).toBe("navCapture");
    expect(key("/kisumu", "?tour=rank")).toBe("navKisumu");
  });
  it("marks nothing on other pages", () => {
    expect(key("/elsewhere")).toBeNull();
  });
});
