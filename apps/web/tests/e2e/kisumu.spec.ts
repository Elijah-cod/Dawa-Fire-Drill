import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Kisumu map follows the selected synthetic scenario", async ({
  page,
}, testInfo) => {
  await page.goto("http://localhost:3300/");
  await page
    .getByRole("region", { name: "County list" })
    .getByRole("button", { name: /Kisumu.*042/ })
    .click();
  await page.getByRole("link", { name: "Explore Kisumu pilot" }).click();
  await expect(
    page.getByRole("heading", { name: "Kisumu synthetic pilot" }),
  ).toBeVisible();
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "Open facility map" }).click();
  await expect(
    page.getByText("Facility locations are synthetic."),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Illustrative stockout risk" }),
  ).toContainText(
    "Illustrative thresholds, not clinical or operational standards.",
  );
  await expect(
    page.getByRole("region", { name: "Illustrative stockout risk" }),
  ).toContainText("8–30 days");
  await page
    .getByRole("heading", { name: "Facility locations are synthetic." })
    .scrollIntoViewIfNeeded();
  const marker = page.locator(
    ".facility-marker[aria-label*='Synthetic facility 004']",
  );
  await expect(marker).toHaveAttribute("aria-label", /Stable/, {
    timeout: 20000,
  });
  await marker.focus();
  await page.keyboard.press("Enter");
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "Close map" }).click();
  await expect(
    page.getByRole("heading", { name: /Synthetic facility 004.*F004/ }),
  ).toBeVisible();
  const slider = page.getByLabel(/Donor logistics support reduction/i);
  await slider.focus();
  await page.keyboard.press("End");
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "Open facility map" }).click();
  const watch = page.locator(
    ".facility-marker[aria-label*='Synthetic facility 004']",
  );
  await expect(watch).toHaveAttribute(
    "aria-label",
    /Watch · 26 days to stockout/,
    {
      timeout: 30000,
    },
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
});

test("facility role sees only its trusted facility", async ({ page }) => {
  await page.goto("http://localhost:3300/kisumu");
  await page.getByLabel("Demo role").selectOption("facility");
  await expect(
    page.getByRole("heading", { name: /Synthetic facility 001.*F001/ }),
  ).toBeVisible();
  await expect(page.getByText(/Synthetic facility 002/)).toHaveCount(0);
});

test("optimizer ranks a synthetic fix for the first shock-caused stockout", async ({
  page,
}, testInfo) => {
  await page.goto("http://localhost:3300/kisumu");
  await expect(
    page.getByRole("heading", { name: "Kisumu synthetic pilot" }),
  ).toBeVisible();
  await page.getByLabel(/Donor logistics support reduction/i).fill("40");
  const section = page.getByRole("region", { name: "Do this first" });
  await expect(section).toBeVisible({ timeout: 30000 });
  await section.getByRole("button", { name: "Rank feasible actions" }).click();
  await expect(
    section.getByRole("heading", { name: "Plain-language explanation" }),
  ).toBeVisible({ timeout: 30000 });
  await expect(section).toContainText("Redistribution transfer");
  await expect(section).toContainText("Emergency delivery");
  await expect(section).toContainText("Budget used: 30 KES");
  await expect(section).toContainText(
    "Not funded: it does not fit in the remaining budget.",
  );
  await expect(section).toContainText("The assumed cost exceeds the ceiling.");
  await expect(section).toContainText("F031");
  await expect(section).toContainText("C04");
  await expect(section).toContainText("Budget cut line");
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("ranked-fixes.png"),
    fullPage: true,
  });
});

test("every synthetic facility marker is inside the map and clear of its controls", async ({
  page,
}, testInfo) => {
  await page.goto("http://localhost:3300/kisumu");
  const mobile = testInfo.project.name === "mobile";
  if (mobile)
    await page.getByRole("button", { name: "Open facility map" }).click();
  const map = page.locator(
    mobile ? "dialog .facility-map" : ".desktop-grid .facility-map",
  );
  await expect(map.locator(".facility-marker")).toHaveCount(40, {
    timeout: 30000,
  });
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
        return outside || covered
          ? [marker.getAttribute("aria-label") ?? "marker"]
          : [];
      },
    );
  });
  expect(problems).toEqual([]);
});
