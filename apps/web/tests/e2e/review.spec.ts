import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE = "http://localhost:3300";
const KISUMU = `${BASE}/kisumu`;

async function noSeriousAxe(page: Page) {
  // The verdict fades while a new run loads; check the settled page.
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
    timeout: 30000,
  });
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
}
const ready = (page: Page) =>
  expect(page.locator("#budget-status")).toHaveText(/units used/, {
    timeout: 30000,
  });
async function openScenario(page: Page) {
  const toggle = page.getByRole("button", { name: /Change scenario/ });
  if (
    (await toggle.isVisible()) &&
    (await toggle.getAttribute("aria-expanded")) === "false"
  )
    await toggle.click();
}

test("scenario choices are radio groups with arrow keys; the bottleneck is a disclosure", async ({
  page,
}) => {
  await page.goto(KISUMU);
  await ready(page);
  await openScenario(page);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  const presets = page.getByRole("radiogroup", {
    name: "Donor logistics support cut",
  });
  await expect(presets.getByRole("radio")).toHaveCount(4);
  const forty = presets.getByRole("radio", { name: "40%" });
  await expect(forty).toHaveAttribute("aria-checked", "true");
  await forty.focus();
  await page.keyboard.press("ArrowRight");
  const hundred = presets.getByRole("radio", { name: "100%" });
  await expect(hundred).toBeFocused();
  await expect(hundred).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("region", { name: "What breaks first" }),
  ).toContainText("causes 393 stockouts", { timeout: 30000 });
  await page.keyboard.press("ArrowLeft");
  await expect(forty).toHaveAttribute("aria-checked", "true");
  const compare = page.getByRole("radiogroup", { name: "Compare" });
  await expect(compare.getByRole("radio")).toHaveCount(2);

  await page.getByRole("tab", { name: "Funding trace" }).click();
  const inspect = page.getByRole("button", { name: /Inspect bottleneck/ });
  await expect(inspect).toHaveAttribute("aria-expanded", "false", {
    timeout: 15000,
  });
  await inspect.click();
  await expect(inspect).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#funding-detail dl.funding-detail")).toBeVisible();
  await inspect.click();
  await expect(inspect).toHaveAttribute("aria-expanded", "false");
  await noSeriousAxe(page);
});

test("the tour says where it starts and returns to the view it was started from", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto(`${KISUMU}?shock=20&budget=50&tab=facilities&day=10`);
  await expect(page.locator("#facility-search")).toBeVisible({
    timeout: 30000,
  });
  await page
    .getByRole("button", { name: "Try the tour (about 3 minutes)" })
    .click();
  await expect(page).toHaveURL(/\/\?tour=overview$/);
  const caption = page.getByRole("region", { name: "National overview" });
  await expect(caption).toContainText(
    "The tour starts here, on the national overview, and takes about 3 minutes.",
  );
  await expect(page.getByRole("button", { name: "Next step" })).toBeEnabled({
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page).toHaveURL(/\/kisumu\?tour=kisumu/);
  await page.getByRole("button", { name: "Back to where I started" }).click();
  await expect(page).toHaveURL(
    `${KISUMU}?shock=20&budget=50&tab=facilities&day=10`,
  );
  await expect(page.getByRole("tab", { name: /Facilities/ })).toHaveAttribute(
    "aria-selected",
    "true",
    { timeout: 30000 },
  );
  await expect(
    page.getByRole("radio", { name: "20%", exact: true, includeHidden: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("tab", { name: "Map and fixes" }).click();
  await expect(page.locator("#budget-number")).toHaveValue("50");
  await expect(page.locator("#readout")).toContainText("Day 10 of 90", {
    timeout: 30000,
  });
  await expect(page.locator(".tour-panel")).toHaveCount(0);
});

test("facility search, active sort and the stockout order's filters and position", async ({
  page,
}) => {
  await page.goto(`${KISUMU}?tab=facilities`);
  const table = page.getByRole("region", { name: "Facilities table" });
  await expect(table.locator("tbody tr")).toHaveCount(40, { timeout: 30000 });
  await page.getByLabel("Search facility names").fill("tamarind");
  const rows = table.locator("tbody tr");
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  for (const text of await rows.allTextContents())
    expect(text).toMatch(/^Tamarind /);
  await expect(page.locator(".filter-count")).toHaveText(
    `Showing ${count} of 40 facilities.`,
  );
  const header = table.getByRole("columnheader", { name: /^Facility/ });
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await expect(header).toContainText("ascending");

  await page.getByRole("tab", { name: /Stockout order/ }).click();
  const order = page.getByRole("tabpanel", { name: /Stockout order/ });
  await expect(order.locator(".order-position")).toHaveText(
    "Showing 1–10 of 209",
  );
  await order.getByText("Show all 209 (adds 11–209)").click();
  await expect(order.locator(".order-position")).toHaveText("Showing all 209");
  await order.getByLabel("Sub-county").selectOption({ label: "Kisumu West" });
  await order.getByLabel("Commodity").selectOption({
    label: "Family planning tracer 04",
  });
  await expect(order.locator(".filter-count")).toHaveText(
    /^Showing \d+ of 211 stockouts\.$/,
  );
  for (const text of await order.locator("ol.order li").allTextContents())
    expect(text).toMatch(/Kisumu West.*family planning tracer 04/);
  await noSeriousAxe(page);
});

test("verdict links and next actions open the right tab and move focus", async ({
  page,
}) => {
  await page.goto(KISUMU);
  await ready(page);
  const verdict = page.getByRole("region", { name: "What breaks first" });
  // "Play the timeline" is the filled primary action; "Move the budget" is secondary.
  const fill = (name: string) =>
    verdict
      .getByRole("button", { name })
      .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(await fill("Play the timeline")).not.toBe(
    await fill("Move the budget"),
  );
  await verdict.getByRole("link", { name: "209 stockouts" }).click();
  await expect(page.locator("#stockout-order")).toBeFocused();
  await verdict
    .getByRole("link", {
      name: "Tamarind Crossing Sub-County Hospital (Kisumu West)",
    })
    .click();
  await expect(page.locator("#facility-detail")).toBeFocused();
  await verdict.getByRole("button", { name: "Move the budget" }).click();
  await expect(
    page.getByRole("tab", { name: "Map and fixes" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#budget")).toBeFocused();
  await verdict.getByRole("button", { name: "Play the timeline" }).click();
  const readout = page.locator("#readout");
  await expect(readout).toContainText(/^Day ([1-9]\d?) of 90/, {
    timeout: 5000,
  });
});

test("the view survives reload and back/forward", async ({ page }) => {
  await page.goto(`${KISUMU}?shock=20&budget=40&tab=order&day=41`);
  await expect(
    page.getByRole("tab", { name: /Stockout order/ }),
  ).toHaveAttribute("aria-selected", "true", { timeout: 30000 });
  await page.getByRole("tab", { name: /Facilities/ }).click();
  await expect(page).toHaveURL(/tab=facilities/);
  await page.reload();
  await expect(page.getByRole("tab", { name: /Facilities/ })).toHaveAttribute(
    "aria-selected",
    "true",
    { timeout: 30000 },
  );
  await expect(
    page.getByRole("radio", { name: "20%", exact: true, includeHidden: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.goto(`${BASE}/`);
  await page.goBack();
  await expect(page).toHaveURL(/shock=20&budget=40&tab=facilities&day=41/);
  await expect(page.getByRole("tab", { name: /Facilities/ })).toHaveAttribute(
    "aria-selected",
    "true",
    { timeout: 30000 },
  );
  await page.goForward();
  await expect(page).toHaveURL(`${BASE}/`);
});

test("on phones the bottom bar never covers focus or content, even with large text", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "phone layout only");
  test.setTimeout(120000);
  for (const size of ["100%", "200%"]) {
    await page.goto(KISUMU);
    await ready(page);
    await page.addStyleTag({ content: `html { font-size: ${size}; }` });
    await page.waitForTimeout(300);
    for (let index = 0; index < 60; index++) {
      await page.keyboard.press("Tab");
      const covered = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element || element === document.body) return false;
        if (element.closest(".bottom-nav")) return false;
        const box = element.getBoundingClientRect();
        // Panels taller than the screen cannot fit above the bar; check their top.
        if (box.height > innerHeight / 2) return false;
        const bar = document
          .querySelector(".bottom-nav")!
          .getBoundingClientRect();
        return box.bottom > bar.top + 1;
      });
      expect(covered, `focus ${index} at ${size}`).toBe(false);
    }
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    const [last, barTop, overflow] = await page.evaluate(() => {
      const end = [...document.querySelectorAll("main *")]
        .filter((element) => element.checkVisibility())
        .reduce(
          (bottom, element) =>
            Math.max(bottom, element.getBoundingClientRect().bottom),
          0,
        );
      return [
        end,
        document.querySelector(".bottom-nav")!.getBoundingClientRect().top,
        document.documentElement.scrollWidth > innerWidth,
      ] as const;
    });
    expect(last).toBeLessThanOrEqual(barTop);
    expect(overflow).toBe(false);
  }
  // The facilities table scrolls sideways by keyboard and keeps 44 px targets.
  await page.getByRole("tab", { name: /Facilities/ }).click();
  const region = page.getByRole("region", { name: "Facilities table" });
  await region.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => region.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  const smallest = await region
    .locator("button")
    .evaluateAll((buttons) =>
      Math.min(
        ...buttons.map((button) => button.getBoundingClientRect().height),
      ),
    );
  expect(smallest).toBeGreaterThanOrEqual(44);
});

for (const [name, setup] of [
  ["light", async () => {}],
  [
    "dark",
    async (page: Page) =>
      page.getByLabel("Theme / Mandhari").selectOption("dark"),
  ],
  [
    "Swahili",
    async (page: Page) =>
      page.getByLabel("Language / Lugha").selectOption("sw"),
  ],
] as const) {
  test(`axe finds no serious issues in ${name} on every Kisumu tab and the overview`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.goto(`${BASE}/`);
    await setup(page);
    await page.waitForTimeout(500);
    await noSeriousAxe(page);
    await page
      .getByRole("navigation", { name: /Primary|Urambazaji/ })
      .filter({ visible: true })
      .getByRole("link", { name: "Kisumu" })
      .click();
    await expect(page.locator("#budget-status")).toHaveText(
      /units used|vimetumika/,
      { timeout: 30000 },
    );
    const tabs = await page.getByRole("tab").all();
    expect(tabs).toHaveLength(4);
    for (const tab of tabs) {
      await tab.click();
      await page.waitForTimeout(400);
      await noSeriousAxe(page);
    }
  });
}
