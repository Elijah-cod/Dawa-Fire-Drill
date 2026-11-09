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
import {
  FacilityMap,
  facilityMarkers,
  MAP_FIT_PADDING,
  mapFitPadding,
} from "./facility-map";

const handlers = vi.hoisted(() => new Map<string, (event: unknown) => void>());
const fits = vi.hoisted(() => [] as { bounds: unknown; options: unknown }[]);
// Pixels per degree: county zoom by default; a cluster zoom (maxZoom 18) spreads markers apart.
const view = vi.hoisted(() => ({
  scale: 1000,
  zoom: 9,
  // When set, fitting a cluster leaves the zoom unchanged (a cluster as wide as the view).
  stuck: false,
  jumps: [] as unknown[],
}));
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
    fitBounds(bounds: unknown, options: { maxZoom?: number }) {
      fits.push({ bounds, options });
      if (options.maxZoom === 18 && !view.stuck) {
        view.scale = 10_000_000;
        view.zoom = 18;
        handlers.get("moveend")?.({});
      }
      return this;
    }
    getZoom() {
      return view.zoom;
    }
    jumpTo(options: unknown) {
      view.jumps.push(options);
      return this;
    }
    project([lng, lat]: [number, number]) {
      return { x: lng * view.scale, y: -lat * view.scale };
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
    getElement() {
      return this.element;
    }
    remove() {
      this.element.remove();
    }
  }
  class LngLatBounds {
    points: [number, number][] = [];
    extend(point: [number, number]) {
      this.points.push(point);
      return this;
    }
  }
  class NavigationControl {}
  return { Map, Marker, LngLatBounds, NavigationControl };
});

afterEach(() => {
  cleanup();
  view.scale = 1000;
  view.zoom = 9;
  view.stuck = false;
  view.jumps = [];
});

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
    name: /Synthetic one.*Critical.*Runs out on day 7 of the run.*C1/i,
  });
  expect(marker.getAttribute("title")).toContain("within 45 days");
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

it("labels facilities that were short before the shock in the marker tooltip", async () => {
  const facilities = [
    {
      id: "F001",
      name: "Synthetic one",
      latitude: -0.1,
      longitude: 34.8,
      coordinates_synthetic: true,
    },
    {
      id: "F002",
      name: "Synthetic two",
      latitude: -0.2,
      longitude: 34.9,
      coordinates_synthetic: true,
    },
  ];
  render(
    <FacilityMap
      facilities={facilities}
      risks={{
        F001: { status: "critical", drivers: ["C01"], days: 0 },
        F002: { status: "stable", drivers: ["C01"], days: null },
      }}
      preShock={new Set(["F001"])}
    />,
  );
  expect(
    await screen.findByRole("button", {
      name: "Synthetic one · Critical · Already short before the shock · Out of stock at the start of the run · Driving commodities: C01",
    }),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: /Synthetic two/ })
      .getAttribute("aria-label"),
  ).not.toContain("Already short");
});

it("fits the map to every marker with padding that clears the controls, again on resize", async () => {
  fits.length = 0;
  handlers.clear();
  const facilities = [
    {
      id: "W",
      name: "West",
      latitude: -0.09,
      longitude: 34.54,
      coordinates_synthetic: true,
    },
    {
      id: "E",
      name: "East",
      latitude: -0.15,
      longitude: 35.15,
      coordinates_synthetic: true,
    },
    {
      id: "S",
      name: "South",
      latitude: -0.34,
      longitude: 35.02,
      coordinates_synthetic: true,
    },
  ];
  render(<FacilityMap facilities={facilities} risks={{}} />);
  await vi.waitFor(() => expect(fits).toHaveLength(1));
  const { bounds, options } = fits[0] as {
    bounds: { points: [number, number][] };
    options: { padding: typeof MAP_FIT_PADDING };
  };
  expect(bounds.points).toEqual(
    facilities.map((f) => [f.longitude, f.latitude]),
  );
  // jsdom has no layout, so the container width is 0 and the narrow minimum applies.
  expect(options.padding).toEqual(mapFitPadding(0));
  expect(mapFitPadding(1280)).toEqual({ ...MAP_FIT_PADDING });
  expect(mapFitPadding(654)).toEqual({ ...MAP_FIT_PADDING });
  const phone = mapFitPadding(358);
  expect(phone.left).toBeLessThan(MAP_FIT_PADDING.left);
  for (const padding of [phone, mapFitPadding(1280)]) {
    for (const side of ["top", "left", "right", "bottom"] as const)
      expect(padding[side]).toBeGreaterThan(22);
    expect(padding.right).toBeGreaterThan(padding.left);
    expect(padding.bottom).toBeGreaterThan(padding.top);
  }
  act(() => handlers.get("resize")!({}));
  expect(fits).toHaveLength(2);
  act(() => handlers.get("zoomstart")!({ originalEvent: new Event("wheel") }));
  act(() => handlers.get("resize")!({}));
  expect(fits).toHaveLength(2);
});

it("clusters nearby facilities with count and worst status, then separates them on activation", async () => {
  handlers.clear();
  const near = (id: string, offset: number) => ({
    id,
    name: `Synthetic ${id}`,
    latitude: -0.075 + offset,
    longitude: 34.76 + offset,
    coordinates_synthetic: true,
  });
  const facilities = [near("A", 0), near("B", 0.001), near("C", 0.002)];
  render(
    <FacilityMap
      facilities={facilities}
      risks={{
        A: { status: "stable", drivers: [], days: null },
        B: { status: "critical", drivers: ["C01"], days: 41 },
        C: { status: "watch", drivers: ["C02"], days: 48 },
      }}
      preShock={new Set(["B"])}
      magnitude={40}
    />,
  );
  const cluster = await screen.findByRole("button", {
    name: "3 · 1 Crit · 1 Watch · 1 Stable · 3 synthetic facilities: 1 Critical, 1 Watch, 1 Stable; worst status Critical. Press Enter to zoom in.",
  });
  expect(cluster.textContent).toBe("!3 · 1 Crit · 1 Watch · 1 Stable");
  expect(cluster.dataset.count).toBe("3");
  expect(screen.queryByRole("button", { name: /^Synthetic A/ })).toBeNull();
  expect(document.querySelector(".risk-summary")?.textContent).toBe(
    "40% shock · 3 facilities: 1 Critical · 1 Watch · 1 Stable · 1 already short before the shock",
  );
  act(() => cluster.click());
  const first = screen.getByRole("button", { name: /^Synthetic A · Stable/ });
  expect(document.activeElement).toBe(first);
  expect(
    screen.getByRole("button", {
      name: /^Synthetic B · Critical · Already short/,
    }),
  ).toBeTruthy();
  expect(document.querySelector(".facility-cluster")).toBeNull();
});

it("still zooms in when fitting a wide cluster would not", async () => {
  handlers.clear();
  view.stuck = true;
  render(
    <FacilityMap
      facilities={[
        {
          id: "A",
          name: "Synthetic A",
          latitude: -0.075,
          longitude: 34.76,
          coordinates_synthetic: true,
        },
        {
          id: "B",
          name: "Synthetic B",
          latitude: -0.0751,
          longitude: 34.7601,
          coordinates_synthetic: true,
        },
      ]}
      risks={{}}
    />,
  );
  const cluster = await screen.findByRole("button", { name: /^2 · 2 Unk/ });
  act(() => cluster.click());
  expect(view.jumps).toEqual([{ center: [34.76005, -0.07505], zoom: 11 }]);
});
