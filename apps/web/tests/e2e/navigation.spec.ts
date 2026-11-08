import { expect, test, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE = "http://localhost:3300";

/** The sidebar from 768 px; the bottom bar on phones. */
const navName = (info: TestInfo) =>
  info.project.name === "mobile" ? "Primary (mobile)" : "Primary";

async function expectCurrent(page: Page, info: TestInfo, name: string) {
  const nav = page.getByRole("navigation", {
    name: navName(info),
    exact: true,
  });
  await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
  await expect(nav.locator('a[aria-current="page"]')).toHaveText(name);
  // The other navigation (hidden at this width) agrees, so only one item is ever active.
  const other = page.getByRole("navigation", {
    name: navName(info) === "Primary" ? "Primary (mobile)" : "Primary",
    exact: true,
    includeHidden: true,
  });
  await expect(other.locator('a[aria-current="page"]')).toHaveText(name);
}

async function noSeriousAxe(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
}

async function inViewport(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  const viewport = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
}

const DESTINATIONS = [
  {
    name: "Overview",
    url: /\/$/,
    check: async (page: Page) => {
      await expect(
        page.getByRole("heading", { name: "Where would you act first?" }),
      ).toBeVisible();
    },
  },
  {
    name: "Kisumu",
    url: /\/kisumu(\?.*tab=overview.*)?$/,
    check: async (page: Page) => {
      await expect(
        page.getByRole("heading", { name: "Kisumu", level: 1 }),
      ).toBeVisible();
      await expect(
        page.getByRole("tab", { name: "Map and fixes" }),
      ).toHaveAttribute("aria-selected", "true", { timeout: 15000 });
    },
  },
  {
    name: "Funding trace",
    url: /\/kisumu\?.*tab=funding/,
    check: async (page: Page) => {
      await expect(
        page.getByRole("tab", { name: "Funding trace" }),
      ).toHaveAttribute("aria-selected", "true", { timeout: 15000 });
      const heading = page.getByRole("heading", {
        name: "Where is funding delayed?",
      });
      await expect(heading).toBeFocused({ timeout: 15000 });
      await inViewport(page, "#funding-title");
    },
  },
  {
    name: "Bin-card capture",
    url: /\/kisumu\?view=capture/,
    check: async (page: Page) => {
      await expect(
        page.getByRole("region", { name: "Capture a bin card" }),
      ).toBeVisible({ timeout: 15000 });
      await expect(page.locator("#capture-title")).toBeFocused({
        timeout: 15000,
      });
      await inViewport(page, "#capture-title");
    },
  },
] as const;

for (const start of ["/", "/kisumu"] as const) {
  test(`every primary link works from ${start === "/" ? "Overview" : "Kisumu"}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120000);
    for (const destination of DESTINATIONS) {
      await page.goto(`${BASE}${start}`);
      await expectCurrent(
        page,
        testInfo,
        start === "/" ? "Overview" : "Kisumu",
      );
      await page
        .getByRole("navigation", { name: navName(testInfo), exact: true })
        .getByRole("link", { name: destination.name })
        .click();
      await expect(page).toHaveURL(destination.url, { timeout: 15000 });
      await destination.check(page);
      await expectCurrent(page, testInfo, destination.name);
    }
    await noSeriousAxe(page);
  });
}

test("the active item follows in-page tabs and the same-page capture link", async ({
  page,
}, testInfo) => {
  await page.goto(`${BASE}/kisumu`);
  await page.getByRole("tab", { name: "Funding trace" }).click();
  await expect(page).toHaveURL(/tab=funding/);
  await expectCurrent(page, testInfo, "Funding trace");
  await page.getByRole("tab", { name: /Facilities/ }).click();
  await expectCurrent(page, testInfo, "Kisumu");
  // Same route, only the query string changes: the view must still switch.
  await page
    .getByRole("navigation", { name: navName(testInfo), exact: true })
    .getByRole("link", { name: "Bin-card capture" })
    .click();
  await expect(
    page.getByRole("region", { name: "Capture a bin card" }),
  ).toBeVisible({
    timeout: 15000,
  });
  await expectCurrent(page, testInfo, "Bin-card capture");
});

test("back and forward restore the view and the highlight", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const nav = () =>
    page.getByRole("navigation", { name: navName(testInfo), exact: true });
  await page.goto(`${BASE}/`);
  await nav().getByRole("link", { name: "Funding trace" }).click();
  await DESTINATIONS[2].check(page);
  await nav().getByRole("link", { name: "Bin-card capture" }).click();
  await DESTINATIONS[3].check(page);
  await nav().getByRole("link", { name: "Kisumu" }).click();
  await DESTINATIONS[1].check(page);
  await expectCurrent(page, testInfo, "Kisumu");

  await page.goBack();
  await expect(page).toHaveURL(/view=capture/);
  await expect(
    page.getByRole("region", { name: "Capture a bin card" }),
  ).toBeVisible({
    timeout: 15000,
  });
  await expectCurrent(page, testInfo, "Bin-card capture");

  await page.goBack();
  await expect(page).toHaveURL(/tab=funding/);
  await expect(
    page.getByRole("tab", { name: "Funding trace" }),
  ).toHaveAttribute("aria-selected", "true", { timeout: 15000 });
  await expect(
    page.getByRole("heading", { name: "Where is funding delayed?" }),
  ).toBeVisible();
  await expectCurrent(page, testInfo, "Funding trace");

  await page.goBack();
  await expect(page).toHaveURL(`${BASE}/`);
  await expectCurrent(page, testInfo, "Overview");

  await page.goForward();
  await expect(page).toHaveURL(/tab=funding/);
  await expectCurrent(page, testInfo, "Funding trace");
  await page.goForward();
  await expect(
    page.getByRole("region", { name: "Capture a bin card" }),
  ).toBeVisible({
    timeout: 15000,
  });
  await expectCurrent(page, testInfo, "Bin-card capture");
  await noSeriousAxe(page);
});
