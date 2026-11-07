// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { FacilityView } from "../api/client";
import { FacilitySelf } from "./facility-self";

vi.mock("./facility-map", () => ({
  FacilityMap: () => <p>Facility locations are synthetic.</p>,
}));
afterEach(cleanup);

it("shows only stock for the trusted facility", () => {
  const data = {
    synthetic: true,
    country_code: "KE",
    county_code: "042",
    facility: { id: "F1", name: "Synthetic one" },
    stock: [
      { facility_id: "F1", commodity_id: "C1", opening_stock: 10 },
      { facility_id: "F2", commodity_id: "C2", opening_stock: 20 },
    ],
    consumption: [],
    commodities: [],
  } as unknown as FacilityView;
  render(<FacilitySelf data={data} />);
  expect(screen.getByText(/C1.*10/)).toBeTruthy();
  expect(screen.queryByText(/C2.*20/)).toBeNull();
});
