// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { RadioGroup } from "./radio-group";
afterEach(cleanup);

function Harness() {
  const [value, setValue] = useState(40);
  return (
    <>
      <span id="label">Shock</span>
      <RadioGroup
        labelledBy="label"
        options={[0, 20, 40, 100].map((n) => ({ value: n, label: `${n}%` }))}
        value={value}
        onChange={setValue}
      />
    </>
  );
}

it("is a labelled radio group with one tab stop on the checked option", () => {
  render(<Harness />);
  const group = screen.getByRole("radiogroup", { name: "Shock" });
  const radios = screen.getAllByRole("radio");
  expect(group).toBeTruthy();
  expect(radios.map((radio) => radio.getAttribute("aria-checked"))).toEqual([
    "false",
    "false",
    "true",
    "false",
  ]);
  expect(radios.map((radio) => radio.tabIndex)).toEqual([-1, -1, 0, -1]);
  expect(screen.queryByRole("checkbox")).toBeNull();
});

it("moves and selects with the arrow keys, wrapping, and Home and End", () => {
  render(<Harness />);
  const radio = (name: string) => screen.getByRole("radio", { name });
  radio("40%").focus();
  fireEvent.keyDown(radio("40%"), { key: "ArrowRight" });
  expect(document.activeElement).toBe(radio("100%"));
  expect(radio("100%").getAttribute("aria-checked")).toBe("true");
  fireEvent.keyDown(radio("100%"), { key: "ArrowDown" });
  expect(radio("0%").getAttribute("aria-checked")).toBe("true");
  fireEvent.keyDown(radio("0%"), { key: "ArrowLeft" });
  expect(radio("100%").getAttribute("aria-checked")).toBe("true");
  fireEvent.keyDown(radio("100%"), { key: "Home" });
  expect(document.activeElement).toBe(radio("0%"));
  fireEvent.keyDown(radio("0%"), { key: "End" });
  expect(radio("100%").getAttribute("aria-checked")).toBe("true");
  fireEvent.click(radio("20%"));
  expect(radio("20%").tabIndex).toBe(0);
});
