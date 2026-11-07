import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Kisumu map follows the selected synthetic scenario", async ({ page }) => {
  await page.goto("http://localhost:3300/");
  await page
    .getByRole("region", { name: "County list" })
    .getByRole("button", { name: /Kisumu.*042/ })
    .click();
  await page.getByRole("link", { name: "Explore Kisumu pilot" }).click();
  await expect(
    page.getByRole("heading", { name: "Kisumu synthetic pilot" }),
  ).toBeVisible();
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
  const marker = page.locator(
    ".facility-marker[aria-label*='Synthetic facility 004']",
  );
  await expect(marker).toHaveAttribute("aria-label", /Stable/, {
    timeout: 20000,
  });
  await marker.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: /Synthetic facility 004.*F004/ }),
  ).toBeVisible();
  const slider = page.getByLabel(/Donor logistics support reduction/i);
  await slider.focus();
  await page.keyboard.press("End");
  const watch = page.locator(
    ".facility-marker[aria-label*='Synthetic facility 004']",
  );
  await expect(watch).toHaveAttribute("aria-label", /Watch.*30 days/, {
    timeout: 30000,
  });
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
