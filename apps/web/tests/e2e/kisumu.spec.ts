import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const KISUMU = "http://localhost:3300/kisumu";

async function noSeriousAxe(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
}
async function noSidewaysScroll(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
const verdict = (page: Page) =>
  page.getByRole("region", { name: "What breaks first" });
const budgetStatus = (page: Page) => page.locator("#budget-status");

/** On phones and tablets the presets sit behind "Change scenario". */
async function pickShock(page: Page, label: string) {
  const toggle = page.getByRole("button", { name: /Change scenario/ });
  if (
    (await toggle.isVisible()) &&
    (await toggle.getAttribute("aria-expanded")) === "false"
  )
    await toggle.click();
  await page
    .getByRole("complementary", { name: "Scenario" })
    .getByRole("button", { name: label, exact: true })
    .click();
}

test("Kisumu leads with what breaks first and the cheapest fix, from the backend", async ({
  page,
}, testInfo) => {
  await page.goto(KISUMU);
  await expect(
    page.getByRole("heading", { name: "Kisumu", level: 1 }),
  ).toBeVisible();
  await expect(verdict(page)).toContainText(
    "A 40% cut in donor logistics support causes 209 stockouts within 90 days; Tamarind Crossing Sub-County Hospital (Kisumu West) runs out of family planning tracer 04 first, on day 41.",
    { timeout: 30000 },
  );
  await expect(verdict(page)).toContainText(
    "The fixes address only the 4 earliest of 209 shock-caused stockouts.",
  );
  await expect(verdict(page)).toContainText(
    "At 30 units (illustrative) the optimizer funds 3 transfers (30 units), each keeping the one medicine it targets at that facility stocked through day 90. Jacaranda Ridge Sub-County Hospital (day 44) does not fit what is left.",
    { timeout: 30000 },
  );
  await expect(verdict(page)).toContainText(
    "211 stockouts in total: 209 caused by the shock, 2 already short before it (Acacia Ridge Dispensary from day 1 and Cedar Ridge Dispensary from day 6)",
  );
  await expect(verdict(page)).toContainText(
    "10 Critical · 18 Watch · 12 Stable",
  );
  await expect(page.getByRole("note")).toContainText(
    "Facilities, names, locations and costs are invented. Results are illustrative, not validated.",
  );
  const viewport = page.viewportSize()!;
  if (testInfo.project.name === "mobile") {
    // Phones: "Change scenario" on the first screen and the map within one swipe.
    const change = await page
      .getByRole("button", { name: /Change scenario/ })
      .boundingBox();
    expect(change!.y + change!.height).toBeLessThanOrEqual(viewport.height);
    const map = await page.locator(".area-map").boundingBox();
    expect(map!.y).toBeLessThan(viewport.height * 2);
    // The fixed bottom bar never covers the end of the page.
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    const [lastBottom, barTop] = await page.evaluate(() => {
      const last = [...document.querySelectorAll("main *")]
        // Closed disclosures keep a box for their hidden content; skip anything not visible.
        .filter((element) => element.checkVisibility())
        .reduce(
          (bottom, element) =>
            Math.max(bottom, element.getBoundingClientRect().bottom),
          0,
        );
      return [
        last,
        document.querySelector(".bottom-nav")!.getBoundingClientRect().top,
      ];
    });
    expect(lastBottom).toBeLessThanOrEqual(barTop);
  }
  await noSidewaysScroll(page);
  await noSeriousAxe(page);
});

test("the four prepared shocks match the backend runs", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto(KISUMU);
  await expect(verdict(page)).toContainText("209 stockouts", {
    timeout: 30000,
  });
  for (const [label, text, counts] of [
    [
      "20%",
      "The fixes address only 4 of 77 shock-caused stockouts (days 47 to 74).",
      "2 Critical · 5 Watch · 33 Stable",
    ],
    [
      "100%",
      "None of the 4 listed transfers can arrive in time: they arrive from day 39, but their stockouts happen by day 26.",
      "40 Critical · 0 Watch · 0 Stable",
    ],
    [
      "0%",
      "With no shock, nothing new runs out within 90 days.",
      "2 Critical · 0 Watch · 38 Stable",
    ],
    [
      "40%",
      "causes 209 stockouts within 90 days",
      "10 Critical · 18 Watch · 12 Stable",
    ],
  ] as const) {
    await pickShock(page, label);
    await expect(verdict(page)).toContainText(text, { timeout: 30000 });
    await expect(verdict(page)).toContainText(counts);
  }
  // Compare flips to the no-shock run while 40% stays selected.
  await page
    .getByRole("complementary", { name: "Scenario" })
    .getByRole("button", { name: "No shock" })
    .click();
  await expect(verdict(page)).toContainText("With no shock", {
    timeout: 30000,
  });
  await expect(
    page.getByRole("button", { name: "40%", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await noSeriousAxe(page);
});

test("the budget slider funds three transfers at 30, four at 100 and none at 5", async ({
  page,
}) => {
  await page.goto(KISUMU);
  const fixes = page.getByRole("region", { name: "Cheapest fixes" });
  await expect(budgetStatus(page)).toHaveText("30 of 30 units used.", {
    timeout: 30000,
  });
  await expect(fixes.locator(".option--funded")).toHaveCount(3);
  await expect(fixes).toContainText(
    "Not funded: Does not fit in what is left of the budget",
  );
  await expect(fixes).not.toContainText("KES");
  const slider = page.getByLabel("Budget (illustrative units)");
  await slider.fill("100");
  await expect(budgetStatus(page)).toHaveText("40 of 100 units used.", {
    timeout: 30000,
  });
  await expect(fixes.locator(".option--funded")).toHaveCount(4);
  await expect(verdict(page)).toContainText(
    "At 100 units (illustrative) the optimizer funds 4 transfers (40 units)",
  );
  await slider.fill("5");
  await expect(budgetStatus(page)).toHaveText(
    "Nothing fits 5 units. The cheapest fix costs 10 units.",
    { timeout: 30000 },
  );
  await expect(fixes.locator(".option--funded")).toHaveCount(0);
  await expect(fixes.locator(".explain-summary")).toHaveText(
    "Nothing is funded: the cheapest option costs 10 units, more than the 5-unit budget.",
  );
  await slider.fill("30");
  await expect(budgetStatus(page)).toHaveText("30 of 30 units used.", {
    timeout: 30000,
  });
  await expect(fixes.locator(".explain-summary")).toHaveText(
    "Transfers and emergency deliveries give the same delay here, so the cheaper transfers are funded first.",
  );
  await fixes.getByText("Why these picks?").click();
  await expect(fixes.locator('.explain p[lang="en"]')).toContainText(
    "OR-Tools selected the transfer to Tamarind Crossing Sub-County Hospital",
  );
  // "3 transfers" in the verdict jumps to the funded fixes.
  await verdict(page).getByRole("link", { name: "3 transfers" }).click();
  await expect(fixes.locator(".option--funded").first()).toBeFocused();
  await noSeriousAxe(page);
});

test("tabs follow the ARIA pattern and the verdict's phrases open them", async ({
  page,
}, testInfo) => {
  await page.goto(KISUMU);
  await expect(verdict(page)).toContainText("209 stockouts", {
    timeout: 30000,
  });
  const wrap = page.locator(".tabs-wrap");
  if (testInfo.project.name === "mobile")
    // The strip scrolls on phones; the edge cue says so.
    await expect(wrap).toHaveAttribute("data-more-end", "true");
  const first = page.getByRole("tab", { name: "Map and fixes" });
  await expect(first).toHaveAttribute("aria-selected", "true");
  await first.focus();
  await page.keyboard.press("ArrowRight");
  const order = page.getByRole("tab", { name: /Stockout order/ });
  await expect(order).toBeFocused();
  await expect(order).toHaveAttribute("aria-selected", "true");
  await expect(order).toContainText("209");
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: /Facilities/ })).toBeFocused();
  // The selected tab scrolls into the strip's view, and the end cue clears.
  const [tabBox, stripBox] = await Promise.all([
    page.getByRole("tab", { name: /Facilities/ }).boundingBox(),
    page.locator(".tabs").boundingBox(),
  ]);
  expect(tabBox!.x + tabBox!.width).toBeLessThanOrEqual(
    stripBox!.x + stripBox!.width + 1,
  );
  await expect(wrap).not.toHaveAttribute("data-more-end", "true");
  await page.keyboard.press("Home");
  await expect(first).toBeFocused();
  await verdict(page).getByRole("link", { name: "209 stockouts" }).click();
  await expect(order).toHaveAttribute("aria-selected", "true");
  const panel = page.getByRole("tabpanel", { name: /Stockout order/ });
  await expect(panel).toContainText("Already short before the shock (2)");
  await expect(panel).toContainText("Caused by the shock (209)");
  await verdict(page)
    .getByRole("link", {
      name: "Tamarind Crossing Sub-County Hospital (Kisumu West)",
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Tamarind Crossing Sub-County Hospital · SYN-KE-042-F031",
    }),
  ).toBeVisible();
  await noSeriousAxe(page);
});

test("the timeline counts match the run at days 0, 41 and 90", async ({
  page,
}) => {
  await page.goto(KISUMU);
  const readout = page.locator("#readout");
  await expect(readout).toContainText("Day 45 of 90: 11 of 211", {
    timeout: 30000,
  });
  const day = page.getByLabel("Day of the 90-day run");
  for (const [value, soFar, out] of [
    [0, 0, 0],
    [41, 3, 3],
    [90, 211, 40],
  ] as const) {
    await day.fill(String(value));
    await expect(readout).toHaveText(
      `Day ${value} of 90: ${soFar} of 211 stockouts so far, ${out} of 40 facilities out of at least one commodity. Modeled, no intervention.`,
    );
  }
  await page.getByRole("button", { name: "Back one week" }).click();
  await expect(readout).toContainText("Day 83 of 90");
  await expect(page.locator(".area")).toHaveCount(7);
  await noSeriousAxe(page);
});

test("the timeline shows a loading state, not zero counts, until the run arrives", async ({
  page,
}) => {
  // Hold the scenario run requests so the loading state is visible.
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/counties/042/runs**", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto(KISUMU);
  const readout = page.locator("#readout");
  await expect(readout).toHaveText("Loading the run…", { timeout: 15000 });
  await expect(readout).not.toContainText("0 of 0");
  await expect(page.locator(".map-panel")).toHaveAttribute("aria-busy", "true");
  release();
  await expect(readout).toContainText(
    "Day 45 of 90: 11 of 211 stockouts so far",
    {
      timeout: 30000,
    },
  );
  await expect(page.locator(".map-panel")).toHaveAttribute(
    "aria-busy",
    "false",
  );
});

test("facilities can be sorted, filtered and opened", async ({ page }) => {
  await page.goto(KISUMU);
  await expect(verdict(page)).toContainText("209 stockouts", {
    timeout: 30000,
  });
  await page.getByRole("tab", { name: /Facilities/ }).click();
  const table = page.getByRole("region", { name: "Facilities table" });
  const rows = table.locator("tbody tr");
  await expect(rows).toHaveCount(40);
  await page.getByRole("button", { name: "Critical", exact: true }).click();
  await expect(rows).toHaveCount(10);
  await expect(page.locator(".filter-count")).toHaveText(
    "Showing 10 of 40 facilities.",
  );
  await table.getByRole("button", { name: /First stockout/ }).click();
  await expect(rows.first()).toContainText("Acacia Ridge Dispensary");
  await table
    .getByRole("button", { name: "Tamarind Crossing Sub-County Hospital" })
    .click();
  const detail = page.locator("#facility-detail");
  await expect(detail).toContainText("Family planning tracer 04: day 41");
  await expect(detail).toContainText(
    "Planted transfer: family planning tracer 04",
  );
  await noSidewaysScroll(page);
  await noSeriousAxe(page);
});

test("the facility map clusters by keyboard and opens the chosen facility", async ({
  page,
}, testInfo) => {
  await page.goto(KISUMU);
  await page.getByRole("tab", { name: /Facilities/ }).click();
  const mobile = testInfo.project.name === "mobile";
  if (mobile)
    await page.getByRole("button", { name: "Open facility map" }).click();
  const map = () => page.locator(mobile ? "dialog" : ".desktop-grid").first();
  await expect(map().locator(".risk-summary")).toHaveText(
    "40% shock · 40 facilities: 10 Critical · 18 Watch · 12 Stable · 2 already short before the shock",
    { timeout: 30000 },
  );
  await map().locator(".facility-map").scrollIntoViewIfNeeded();
  const cluster = map().locator(".facility-cluster").first();
  await expect(cluster).toHaveAttribute(
    "aria-label",
    /^(\d+)( · \d+ (Crit|Watch|Stable|Unk))+ · \1 synthetic facilities: .*; worst status (Critical|Watch|Stable|Unknown)\. Press Enter to zoom in\.$/,
    { timeout: 30000 },
  );
  await cluster.focus();
  for (let step = 0; step < 6; step++) {
    await page.keyboard.press("Enter");
    await expect(page.locator(".facility-marker:focus")).toHaveCount(1);
    if (!(await page.locator(".facility-cluster:focus").count())) break;
  }
  const focused = page.locator(".facility-marker:not(.facility-cluster):focus");
  const name = (await focused.getAttribute("aria-label"))!.split(" · ")[0];
  expect(name).toMatch(
    /^(Acacia|Mvule|Cedar|Jacaranda|Neem|Fig|Tamarind|Croton) /,
  );
  await page.keyboard.press("Enter");
  if (mobile) await page.getByRole("button", { name: "Close map" }).click();
  await expect(
    page.getByRole("heading", { name: new RegExp(`^${name} · SYN-`) }),
  ).toBeVisible();
  await noSidewaysScroll(page);
  await noSeriousAxe(page);
});

test("every facility marker is inside the map and clear of its controls", async ({
  page,
}, testInfo) => {
  await page.goto(KISUMU);
  await page.getByRole("tab", { name: /Facilities/ }).click();
  const mobile = testInfo.project.name === "mobile";
  if (mobile)
    await page.getByRole("button", { name: "Open facility map" }).click();
  const map = page.locator(
    mobile ? "dialog .facility-map" : ".desktop-grid .facility-map",
  );
  await map.scrollIntoViewIfNeeded();
  await expect(map.locator(".facility-marker").first()).toBeVisible({
    timeout: 30000,
  });
  expect(
    await map.evaluate((element) =>
      [...element.querySelectorAll(".facility-marker")].reduce(
        (sum, item) => sum + Number((item as HTMLElement).dataset.count ?? 1),
        0,
      ),
    ),
  ).toBe(40);
  await page.waitForTimeout(1000);
  const problems = await map.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const controls = [...element.querySelectorAll(".maplibregl-ctrl")].map(
      (item) => item.getBoundingClientRect(),
    );
    return [...element.querySelectorAll(".facility-marker")].flatMap(
      (marker) => {
        const r = marker.getBoundingClientRect();
        const outside =
          r.left < box.left ||
          r.right > box.right ||
          r.top < box.top ||
          r.bottom > box.bottom;
        const covered = controls.some(
          (c) =>
            r.left < c.right &&
            r.right > c.left &&
            r.top < c.bottom &&
            r.bottom > c.top,
        );
        // Report the edges crossed, so a failure says where.
        return outside || covered
          ? [
              `${marker.getAttribute("aria-label") ?? "marker"} [${Math.round(r.left - box.left)} ${Math.round(box.right - r.right)} ${Math.round(r.top - box.top)} ${Math.round(box.bottom - r.bottom)}${covered ? " covered" : ""}]`,
            ]
          : [];
      },
    );
  });
  expect(problems).toEqual([]);
});

test("a shared link recreates shock, budget, tab and day", async ({ page }) => {
  await page.goto(`${KISUMU}?shock=20&budget=40&tab=order&day=41`);
  await expect(verdict(page)).toContainText(
    "The fixes address only 4 of 77 shock-caused stockouts",
    { timeout: 30000 },
  );
  await expect(
    page.getByRole("tab", { name: /Stockout order/ }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Map and fixes" }).click();
  await expect(page.locator("#readout")).toContainText("Day 41 of 90");
  await expect(budgetStatus(page)).toHaveText("40 of 40 units used.", {
    timeout: 30000,
  });
  await page.getByLabel("Budget (illustrative units)").fill("100");
  await expect(page).toHaveURL(/shock=20&budget=100&tab=overview&day=41/);
});

test("facility role sees only its trusted facility", async ({ page }) => {
  await page.goto(KISUMU);
  await page.getByLabel("Demo role").selectOption("facility");
  await expect(
    page.getByRole("heading", { name: /Synthetic facility 001.*F001/ }),
  ).toBeVisible();
  await expect(page.getByText(/Synthetic facility 002/)).toHaveCount(0);
});
