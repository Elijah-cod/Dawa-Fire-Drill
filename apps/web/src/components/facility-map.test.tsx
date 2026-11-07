// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import oldFacilities from "../fixtures/kisumu-v2-facilities.json";
import { FacilityMap, facilityMarkers } from "./facility-map";

vi.mock("maplibre-gl", () => {
  class Map {
    container: HTMLElement;
    constructor(options: { container: HTMLElement }) {
      this.container = options.container;
    }
    on() {
      return this;
    }
    fitBounds() {
      return this;
    }
    addControl() {
      return this;
    }
    remove() {
      this.container.replaceChildren();
    }
  }
  class Marker {
    element: HTMLElement;
    constructor(options: { element: HTMLElement }) {
      this.element = options.element;
    }
    setLngLat() {
      return this;
    }
    addTo(map: Map) {
      map.container.append(this.element);
      return this;
    }
  }
  class LngLatBounds {
    extend() {
      return this;
    }
  }
  class NavigationControl {}
  return { Map, Marker, LngLatBounds, NavigationControl };
});

afterEach(cleanup);

it("shows the map-unavailable state for a version without synthetic coordinates", () => {
  render(<FacilityMap facilities={oldFacilities} risks={{}} />);
  expect(screen.getByText(/facility map unavailable/i)).toBeTruthy();
});

it("shows synthetic location labeling, thresholds, and an accessible risk marker", async () => {
  const select = vi.fn();
  render(
    <FacilityMap
      facilities={[
        {
          id: "SYN-1",
          name: "Synthetic one",
          latitude: -0.1,
          longitude: 34.8,
          coordinates_synthetic: true,
        },
      ]}
      risks={{ "SYN-1": { status: "critical", drivers: ["C1"], days: 7 } }}
      onSelect={select}
    />,
  );
  expect(screen.getByText("Facility locations are synthetic.")).toBeTruthy();
  expect(
    screen.getByText(
      /illustrative thresholds, not clinical or operational standards/i,
    ),
  ).toBeTruthy();
  const marker = await screen.findByRole("button", {
    name: /Synthetic one.*Critical.*7 days.*C1/i,
  });
  expect(marker.getAttribute("title")).toContain("within 7 days");
  fireEvent.click(marker);
  expect(select).toHaveBeenCalledWith("SYN-1");
});

it("gives each known risk a non-color symbol and defaults missing risk to unknown", () => {
  const markers = facilityMarkers(
    [
      {
        id: "SYN-1",
        name: "Synthetic one",
        latitude: -0.1,
        longitude: 34.8,
        coordinates_synthetic: true,
      },
      {
        id: "SYN-2",
        name: "Synthetic two",
        latitude: -0.2,
        longitude: 34.9,
        coordinates_synthetic: true,
      },
    ],
    { "SYN-1": { status: "critical", drivers: ["C1"], days: 7 } },
  );
  expect(markers.map((marker) => marker.symbol)).toEqual(["!", "?"]);
  expect(markers.map((marker) => marker.risk)).toEqual(["critical", "unknown"]);
});

it("never renders coordinates without an explicit synthetic marker", () => {
  const markers = facilityMarkers(
    [{ id: "SYN-1", name: "Synthetic one", latitude: -0.1, longitude: 34.8 }],
    {},
  );
  expect(markers).toEqual([]);
});
