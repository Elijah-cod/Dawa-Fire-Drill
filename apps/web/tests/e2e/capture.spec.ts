import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { syntheticPng } from "./helpers";

test("facility in-charge uploads a synthetic bin card and confirms every field", async ({
  page,
}) => {
  await page.goto("http://localhost:3300/kisumu");
  await page.getByLabel("Demo role").selectOption("facility");
  const capture = page.getByRole("region", { name: "Capture a bin card" });
  await expect(capture).toBeVisible();
  await capture.getByLabel(/synthetic bin card with no real/i).check();
  await capture.getByLabel(/bin-card photo/i).setInputFiles({
    name: "synthetic-card.png",
    mimeType: "image/png",
    buffer: syntheticPng(),
  });
  await capture.getByRole("button", { name: "Read the card" }).click();
  await expect(capture).toContainText(
    /Automatic reading is unavailable|Check every value|Some fields were unclear/,
    { timeout: 15000 },
  );
  await capture.getByLabel("Commodity name").fill("Synthetic tracer");
  await capture.getByLabel("Opening balance (units)").fill("40");
  await capture.getByLabel("Closing balance (units)").fill("12");
  await capture.getByLabel("Record date").fill("2026-11-01");
  await capture.getByRole("button", { name: "Review and save" }).click();
  await expect(
    capture.getByRole("heading", { name: /save these values/i }),
  ).toBeFocused();
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
  await capture.getByRole("button", { name: "Confirm and save" }).click();
  await expect(capture).toContainText(
    "Saved to this synthetic facility: Synthetic tracer · 40 → 12 · 2026-11-01",
    { timeout: 15000 },
  );
});
