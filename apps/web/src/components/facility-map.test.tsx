// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import oldFacilities from "../fixtures/kisumu-v2-facilities.json";
import { FacilityMap, facilityMarkers } from "./facility-map";

const handlers = vi.hoisted(() => new Map<string, (event: unknown) => void>());
vi.mock("maplibre-gl", () => {
  class Map {
    container: HTMLElement;
    constructor(options: { container: HTMLElement }) {
      this.container = options.container;
    }
    on(type: string, handler: (event: unknown) => void) {
      handlers.set(type, handler);
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

it("defers loading map markers until the map approaches the viewport", async () => {
  let notify: IntersectionObserverCallback = () => {};
  class Observer {
    constructor(callback: IntersectionObserverCallback) {
      notify = callback;
    }
    observe() {}
    disconnect() {}
    unobserve() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  }
  vi.stubGlobal("IntersectionObserver", Observer);
  try {
    render(
      <FacilityMap
        facilities={[
          {
            id: "SYN-1",
            name: "Synthetic deferred",
            latitude: -0.1,
            longitude: 34.8,
            coordinates_synthetic: true,
          },
        ]}
        risks={{}}
      />,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(
      screen.queryByRole("button", { name: /Synthetic deferred/ }),
    ).toBeNull();
    notify(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(
      await screen.findByRole("button", { name: /Synthetic deferred/ }),
    ).toBeTruthy();
  } finally {
    vi.unstubAllGlobals();
  }
});

it("reports unavailable tiles only after a real basemap tile failure", async () => {
  handlers.clear();
  render(
    <FacilityMap
      facilities={[
        {
          id: "F1",
          name: "Synthetic facility one",
          latitude: -0.07,
          longitude: 34.76,
          coordinates_synthetic: true,
        },
      ]}
      risks={{}}
    />,
  );
  await vi.waitFor(() => expect(handlers.has("error")).toBe(true));
  const notice = () => screen.queryByText(/map tiles are unavailable/i);
  act(() =>
    handlers.get("error")!({ error: new Error("Worker failed to load") }),
  );
  act(() =>
    handlers.get("error")!({
      sourceId: "osm",
      tile: {},
      error: Object.assign(new Error("aborted"), { name: "AbortError" }),
    }),
  );
  expect(notice()).toBeNull();
  act(() =>
    handlers.get("error")!({
      sourceId: "osm",
      tile: {},
      error: new Error("503"),
    }),
  );
  expect(notice()).not.toBeNull();
  act(() =>
    handlers.get("data")!({ dataType: "source", sourceId: "osm", tile: {} }),
  );
  expect(notice()).toBeNull();
  act(() =>
    handlers.get("error")!({
      sourceId: "osm",
      tile: {},
      error: new Error("404"),
    }),
  );
  expect(notice()).toBeNull();
});
