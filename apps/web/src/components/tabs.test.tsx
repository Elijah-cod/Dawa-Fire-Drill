// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { TabList } from "./tabs";
afterEach(cleanup);

function Harness() {
  const [selected, setSelected] = useState<"a" | "b" | "c">("a");
  return (
    <TabList
      label="Views"
      selected={selected}
      onSelect={setSelected}
      items={[
        { id: "a", label: "Map" },
        { id: "b", label: "Order", count: 209 },
        { id: "c", label: "Facilities" },
      ]}
    />
  );
}

it("exposes ARIA tabs with one tab stop and its panel", () => {
  render(<Harness />);
  const tabs = screen.getAllByRole("tab");
  expect(screen.getByRole("tablist", { name: "Views" })).toBeTruthy();
  expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual([
    "true",
    "false",
    "false",
  ]);
  expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
  expect(tabs[1].getAttribute("aria-controls")).toBe("p-b");
  expect(tabs[1].textContent).toBe("Order209");
});

it("moves and selects with arrows, Home and End, wrapping at the ends", () => {
  render(<Harness />);
  const tabs = () => screen.getAllByRole("tab");
  tabs()[0].focus();
  fireEvent.keyDown(tabs()[0], { key: "ArrowRight" });
  expect(document.activeElement).toBe(tabs()[1]);
  expect(tabs()[1].getAttribute("aria-selected")).toBe("true");
  fireEvent.keyDown(tabs()[1], { key: "End" });
  expect(document.activeElement).toBe(tabs()[2]);
  fireEvent.keyDown(tabs()[2], { key: "ArrowRight" });
  expect(document.activeElement).toBe(tabs()[0]);
  fireEvent.keyDown(tabs()[0], { key: "ArrowLeft" });
  expect(document.activeElement).toBe(tabs()[2]);
  fireEvent.keyDown(tabs()[2], { key: "Home" });
  expect(tabs()[0].getAttribute("aria-selected")).toBe("true");
  fireEvent.click(tabs()[1]);
  expect(tabs()[1].tabIndex).toBe(0);
});
