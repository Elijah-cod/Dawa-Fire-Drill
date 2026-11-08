import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("schematic grid has 47 accessible, non-overlapping counties", async ({
  page,
}) => {
  await page.goto("http://localhost:3300/");
  const mobile = (page.viewportSize()?.width ?? 0) < 768;
  if (mobile)
    await page.getByRole("button", { name: "Open schematic map" }).click();
  const grid = page.getByRole("region", { name: "Kenya counties" });
  await expect(
    grid.getByText("Schematic, not to scale.", { exact: false }),
  ).toBeVisible();
  const tiles = grid.getByRole("button");
  await expect(tiles).toHaveCount(47);
  const boxes = await tiles.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
      };
    }),
  );
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      expect(
        boxes[i].left < boxes[j].right &&
          boxes[j].left < boxes[i].right &&
          boxes[i].top < boxes[j].bottom &&
          boxes[j].top < boxes[i].bottom,
      ).toBe(false);
    }
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const kisumu = tiles.filter({ hasText: "Kisumu" });
  await kisumu.focus();
  await page.keyboard.press("Enter");
  if (mobile) await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: /Kisumu.*042/ }),
  ).toBeVisible();
  await expect(
    page.getByText(/Synthetic approved all-sector budget/i),
  ).toBeVisible();
});

test("demo role switching enforces the county overview boundary", async ({
  page,
}) => {
  await page.goto("http://localhost:3300/");
  const switcher = page.getByLabel("Demo role");
  await expect(switcher).toBeVisible();
  await switcher.selectOption("facility");
  await expect(
    page.getByText(/do not have access to this county overview/i),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Kisumu.*042/ })).toHaveCount(
    0,
  );
  await switcher.selectOption("national");
  await expect(
    page
      .getByRole("region", { name: "County list" })
      .getByRole("button", { name: /Kisumu.*042/ }),
  ).toBeVisible();
});

test("language and theme controls preserve the synthetic notice", async ({
  page,
}) => {
  await page.goto("http://localhost:3300/");
  await page.getByLabel("Language / Lugha").selectOption("sw");
  await expect(
    page.getByRole("heading", { name: "Ungechukua hatua wapi kwanza?" }),
  ).toBeVisible();
  await expect(page.getByRole("note")).toContainText(
    "Vituo, majina, maeneo na gharama ni vya kubuni.",
  );
  await page.getByLabel("Theme / Mandhari").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("schematic grid is usable at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("http://localhost:3300/");
  const open = page.getByRole("button", { name: "Open schematic map" });
  await open.click();
  await expect(
    page.getByRole("dialog", { name: "Schematic county map" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: /Kisumu.*042/ }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  const modalAxe = await new AxeBuilder({ page }).analyze();
  expect(
    modalAxe.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("national scaffold has no serious or critical axe violations", async ({
  page,
}) => {
  await page.goto("http://localhost:3300/");
  await expect(
    page
      .getByRole("region", { name: "County list" })
      .getByRole("button", { name: /Kisumu.*042/ }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});
