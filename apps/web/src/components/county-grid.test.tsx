// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import counties from "../data/counties.json";
import { CountyGrid } from "./county-grid";

describe("schematic county grid", () => {
  it("exposes all 47 distinct counties as labelled keyboard controls", () => {
    const select = vi.fn();
    render(<CountyGrid counties={counties} onSelect={select} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(47);
    expect(new Set(buttons.map((button) => button.textContent)).size).toBe(47);
    const kisumu = screen.getByRole("button", { name: /Kisumu.*042/i });
    kisumu.focus();
    fireEvent.click(kisumu);
    expect(select).toHaveBeenCalledWith("042");
    expect(screen.getByText(/schematic, not to scale/i)).toBeTruthy();
  });
});
