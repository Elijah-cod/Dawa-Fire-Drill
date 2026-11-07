import { expect, test } from "@playwright/test";

test("schematic grid has 47 accessible, non-overlapping counties", async ({
  page,
}) => {
  await page.goto("http://localhost:3300/");
  await expect(
    page.getByText("Schematic, not to scale.", { exact: false }),
  ).toBeVisible();
  const tiles = page
    .getByRole("region", { name: "Kenya counties" })
    .getByRole("button");
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
  const kisumu = page.getByRole("button", { name: /Kisumu.*042/ });
  await kisumu.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: /Kisumu.*042/ }),
  ).toBeVisible();
});

test("schematic grid is usable at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("http://localhost:3300/");
  await expect(page.getByRole("button", { name: /Kisumu.*042/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
