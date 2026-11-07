// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { NationalOverview } from "./national-overview";

it("selects a county and identifies planning-only access", () => {
  render(<NationalOverview />);
  fireEvent.click(screen.getByRole("button", { name: /Nairobi.*047/i }));
  expect(screen.getByRole("heading", { name: /Nairobi.*047/i })).toBeTruthy();
  expect(screen.getByText(/planning overview only/i)).toBeTruthy();
});
