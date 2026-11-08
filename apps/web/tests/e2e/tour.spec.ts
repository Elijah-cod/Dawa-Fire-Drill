import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("guided demo walks overview to capture by keyboard", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("http://localhost:3300/");
  const start = page.getByRole("button", { name: "Try the 3-minute demo" });
  await start.focus();
  await page.keyboard.press("Enter");
  const tour = page.getByRole("region", { name: "National overview" });
  await expect(tour).toBeVisible();
  await expect(tour).toContainText("Step 1 / 7");
  await expect(
    page.getByRole("heading", { name: "National overview" }),
  ).toBeFocused();

  const next = async (title: string) => {
    await page.getByRole("button", { name: "Next step" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: title })).toBeFocused({
      timeout: 15000,
    });
  };

  await next("Kisumu pilot");
  await expect(page).toHaveURL(/\/kisumu\?tour=kisumu/);
  await expect(
    page.getByRole("heading", { name: "Kisumu", level: 1 }),
  ).toBeVisible();

  await next("Apply a 40% shock");
  await expect(
    page.getByRole("button", { name: "40%", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await next("First stockout");
  await expect(
    page.getByRole("region", { name: "What breaks first" }),
  ).toContainText(
    "Tamarind Crossing Sub-County Hospital (Kisumu West) runs out of family planning tracer 04 first, on day 41.",
    { timeout: 30000 },
  );

  await next("Funding trace");
  await expect(
    page.getByRole("region", { name: "Where is funding delayed?" }),
  ).toContainText("Approved, not released · 100,000 KES · 90 days waiting", {
    timeout: 15000,
  });

  await next("Ranked fix");
  const ranked = page.getByRole("region", { name: "Cheapest fixes" });
  await expect(ranked.locator(".pair").first()).toContainText(
    "Tamarind Crossing Sub-County Hospital: family planning tracer 04",
    { timeout: 30000 },
  );
  await expect(ranked.locator(".option--funded")).toHaveCount(3);
  await expect(page.locator("#budget-status")).toHaveText(
    "30 of 30 units used.",
  );

  const box = await page
    .getByRole("button", { name: "Next step" })
    .boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && box.y + box.height <= viewport.height).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);

  await next("Bin-card capture");
  await expect(
    page.getByRole("heading", { name: /Synthetic facility 001.*F001/ }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole("region", { name: "Capture a bin card" }),
  ).toHaveAttribute("data-tour-active", "true", { timeout: 15000 });

  await page.getByRole("button", { name: "Finish demo" }).click();
  await expect(
    page.getByRole("region", { name: "Bin-card capture" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Try the 3-minute demo" }),
  ).toBeVisible();
});

test("guided demo exits with Escape and keeps the current screen", async ({
  page,
}) => {
  await page.goto("http://localhost:3300/kisumu?tour=kisumu");
  await expect(
    page.getByRole("heading", { name: "Kisumu pilot" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Kisumu pilot" })).toHaveCount(
    0,
  );
  await expect(page).toHaveURL("http://localhost:3300/kisumu");
});
