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
  ).toContainText("46–52 days");
  await page
    .getByRole("heading", { name: "Facility locations are synthetic." })
    .scrollIntoViewIfNeeded();
  const mobile = testInfo.project.name === "mobile";
  const map = () => page.locator(mobile ? "dialog" : ".desktop-grid").first();
  await expect(map().locator(".risk-summary")).toHaveText(
    "0% shock · 40 facilities: 2 Critical · 0 Watch · 38 Stable · 2 already short before the shock",
    { timeout: 20000 },
  );
  const cluster = map().locator(".facility-cluster").first();
  await expect(cluster).toHaveAttribute(
    "aria-label",
    /^(\d+)( · \d+ (Crit|Watch|Stable|Unk))+ · \1 synthetic facilities: .*; worst status (Critical|Watch|Stable|Unknown)\. Press Enter to zoom in\.$/,
  );
  await cluster.focus();
  // Each Enter zooms into the focused cluster; on narrow screens a large cluster first
  // splits into smaller clusters, and focus follows the group's first facility.
  for (let step = 0; step < 6; step++) {
    await page.keyboard.press("Enter");
    await expect(page.locator(".facility-marker:focus")).toHaveCount(1);
    if (!(await page.locator(".facility-cluster:focus").count())) break;
  }
  const focused = page.locator(".facility-marker:not(.facility-cluster):focus");
  await expect(focused).toHaveAttribute(
    "aria-label",
    /^Synthetic facility \d{3} · /,
  );
  const name = (await focused.getAttribute("aria-label"))!.split(" · ")[0];
  await page.keyboard.press("Enter");
  if (mobile) await page.getByRole("button", { name: "Close map" }).click();
  await expect(
    page.getByRole("heading", { name: new RegExp(`^${name} · `) }),
  ).toBeVisible();
  const slider = page.getByLabel(/Donor logistics support reduction/i);
  await slider.focus();
  await page.keyboard.press("End");
  await page
    .locator(".county-list")
    .getByRole("button", { name: /Synthetic facility 004/ })
    .click();
  await expect(
    page
      .getByRole("heading", { name: /Synthetic facility 004.*F004/ })
      .locator(".."),
  ).toContainText(/Critical · .*26 days to stockout/, { timeout: 30000 });
  if (mobile)
    await page.getByRole("button", { name: "Open facility map" }).click();
  await expect(map().locator(".risk-summary")).toHaveText(
    "100% shock · 40 facilities: 40 Critical · 0 Watch · 0 Stable · 2 already short before the shock",
    { timeout: 30000 },
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
  await expect(map.locator(".facility-marker").first()).toBeVisible({
    timeout: 30000,
  });
  // Each facility is either its own marker or counted in exactly one cluster.
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
        return outside || covered
          ? [marker.getAttribute("aria-label") ?? "marker"]
          : [];
      },
    );
  });
  expect(problems).toEqual([]);
});

test("the Do this first intro stays within two lines with details on demand", async ({
  page,
}) => {
  await page.goto("http://localhost:3300/kisumu");
  await page.getByLabel(/Donor logistics support reduction/i).fill("40");
  const intro = page.locator(".rank-intro");
  await expect(intro).toBeVisible({ timeout: 30000 });
  const lines = await intro.evaluate(
    (element) =>
      element.getBoundingClientRect().height /
      parseFloat(getComputedStyle(element).lineHeight),
  );
  expect(Math.round(lines)).toBeLessThanOrEqual(2);
  const details = page.locator(".rank-details");
  await expect(details).not.toHaveAttribute("open", "");
  await details.locator("summary").click();
  await expect(details).toContainText("10 KES and 50 KES");
});

test("the map summary matches the backend counts at each shock", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await page.goto("http://localhost:3300/kisumu");
  const mobile = testInfo.project.name === "mobile";
  const slider = page.getByLabel(/Donor logistics support reduction/i);
  await expect(slider).toBeEnabled({ timeout: 30000 });
  for (const [magnitude, counts] of [
    [0, "2 Critical · 0 Watch · 38 Stable"],
    [20, "2 Critical · 5 Watch · 33 Stable"],
    [40, "10 Critical · 18 Watch · 12 Stable"],
    [100, "40 Critical · 0 Watch · 0 Stable"],
  ] as const) {
    if (mobile && (await page.locator("dialog[open]").count()))
      await page.getByRole("button", { name: "Close map" }).click();
    await slider.fill(String(magnitude));
    if (mobile)
      await page.getByRole("button", { name: "Open facility map" }).click();
    const map = page.locator(mobile ? "dialog" : ".desktop-grid").first();
    await expect(map.locator(".risk-summary")).toHaveText(
      `${magnitude}% shock · 40 facilities: ${counts} · 2 already short before the shock`,
      { timeout: 30000 },
    );
    const clusters = map.locator(".facility-cluster");
    await expect(clusters.first()).toBeVisible();
    // Visible mix adds up to the cluster size and the text fits inside its pill.
    for (const cluster of await clusters.evaluateAll((items) =>
      items.map((item) => ({
        size: Number((item as HTMLElement).dataset.count),
        text: (item.lastElementChild as HTMLElement).textContent ?? "",
        overflow:
          item.scrollWidth > item.clientWidth + 1 ||
          item.scrollHeight > item.clientHeight + 1,
      })),
    )) {
      const [size, ...parts] = cluster.text.split(" · ");
      expect(Number(size)).toBe(cluster.size);
      expect(
        parts.reduce((sum, part) => sum + Number(part.split(" ")[0]), 0),
      ).toBe(cluster.size);
      expect(cluster.overflow).toBe(false);
    }
    // No two cluster labels overlap on screen.
    const boxes = await clusters.evaluateAll((items) =>
      items.map((item) => {
        const r = item.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      }),
    );
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++)
        expect(
          boxes[i].right <= boxes[j].left ||
            boxes[j].right <= boxes[i].left ||
            boxes[i].bottom <= boxes[j].top ||
            boxes[j].bottom <= boxes[i].top,
        ).toBe(true);
    for (const label of await clusters.evaluateAll((items) =>
      items.map((item) => item.getAttribute("aria-label") ?? ""),
    ))
      expect(label).toMatch(
        /^(\d+)( · \d+ (Crit|Watch|Stable|Unk))+ · \1 synthetic facilities: /,
      );
  }
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
});
