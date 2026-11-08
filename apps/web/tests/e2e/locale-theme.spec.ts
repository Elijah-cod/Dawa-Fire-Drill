import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { syntheticPng } from "./helpers";

/** Swahili and dark theme; client-side navigation keeps both for the rest of a test. */
async function swahiliDark(page: Page) {
  await page.getByLabel("Language / Lugha").selectOption("sw");
  await page.getByLabel("Theme / Mandhari").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("lang", "sw");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
}

async function noSeriousAxe(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
}

test("guided demo works in Swahili and dark theme, keeping the English-only explanation note", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("http://localhost:3300/");
  await swahiliDark(page);
  await page
    .getByRole("button", { name: "Jaribu onyesho la dakika 3" })
    .click();
  for (let step = 0; step < 5; step++)
    await page.getByRole("button", { name: "Hatua inayofuata" }).click();
  await expect(
    page.getByRole("heading", { name: "Hatua iliyopangwa" }),
  ).toBeFocused({ timeout: 15000 });
  const ranked = page.locator(".fixes").last();
  await expect(page.locator("#budget-status")).toHaveText(
    "Vipimo 30 kati ya 30 vimetumika.",
    { timeout: 30000 },
  );
  await ranked.getByText("Kwa nini chaguo hizi?").click();
  await expect(ranked).toContainText(
    "Maelezo yanapatikana kwa Kiingereza pekee. Explanation available in English only.",
  );
  await expect(ranked.locator('p[lang="en"]')).toContainText(
    "OR-Tools selected",
  );
  await noSeriousAxe(page);
});

test("funding trace works in Swahili and dark theme", async ({ page }) => {
  await page.goto("http://localhost:3300/kisumu");
  await swahiliDark(page);
  await page.getByRole("tab", { name: "Ufuatiliaji wa ufadhili" }).click();
  const funding = page.getByRole("region", {
    name: "Ufadhili umechelewa wapi?",
  });
  await expect(funding).toContainText("Imekwama hapa", { timeout: 30000 });
  await expect(funding.locator('[aria-current="step"]')).toContainText(
    "Imetolewa",
  );
  await funding.getByRole("button", { name: /Kagua kizuizi/ }).click();
  await expect(funding.locator("dl.funding-detail dd")).toHaveCount(3);
  await noSeriousAxe(page);
});

test("bin-card capture works in Swahili and dark theme from the navigation link", async ({
  page,
}) => {
  await page.goto("http://localhost:3300/kisumu");
  await swahiliDark(page);
  await page
    .getByRole("link", { name: "Kunasa kadi ya akiba" })
    .filter({ visible: true })
    .click();
  const capture = page.getByRole("region", { name: "Nasa kadi ya akiba" });
  await expect(capture).toBeVisible({ timeout: 30000 });
  await capture.getByLabel(/Hii ni kadi ya akiba ya mfano/).check();
  await capture.getByLabel(/Picha ya kadi ya akiba/).setInputFiles({
    name: "synthetic-card.png",
    mimeType: "image/png",
    buffer: syntheticPng(),
  });
  await capture.getByRole("button", { name: "Soma kadi" }).click();
  await expect(capture.getByLabel("Jina la bidhaa")).toBeFocused({
    timeout: 15000,
  });
  await capture.getByLabel("Jina la bidhaa").fill("Synthetic tracer");
  await capture.getByLabel("Salio la mwanzo (vipimo)").fill("40");
  await capture.getByLabel("Salio la mwisho (vipimo)").fill("12");
  await capture.getByLabel("Tarehe ya rekodi").fill("2026-11-01");
  await capture.getByRole("button", { name: "Kagua na uhifadhi" }).click();
  await noSeriousAxe(page);
  await capture.getByRole("button", { name: "Thibitisha na uhifadhi" }).click();
  await expect(capture).toContainText(
    "Imehifadhiwa kwa kituo hiki cha mfano:",
    {
      timeout: 15000,
    },
  );
});

test("clustered map works in Swahili and dark theme", async ({
  page,
}, testInfo) => {
  await page.goto("http://localhost:3300/kisumu");
  await swahiliDark(page);
  await page.getByRole("tab", { name: /Vituo/ }).click();
  const mobile = testInfo.project.name === "mobile";
  if (mobile)
    await page.getByRole("button", { name: "Fungua ramani ya vituo" }).click();
  const map = page.locator(mobile ? "dialog" : ".desktop-grid").first();
  await expect(map.locator(".risk-summary")).toHaveText(
    "40% mshtuko · 40 vituo: 10 Hatari kubwa · 18 Angalizo · 12 Tulivu · 2 tayari vilikuwa na upungufu kabla ya mshtuko",
    { timeout: 30000 },
  );
  // The map loads lazily when it nears the viewport.
  await map.locator(".facility-map").scrollIntoViewIfNeeded();
  await expect(map.locator(".facility-cluster").first()).toBeVisible({
    timeout: 30000,
  });
  const clusters = await map.locator(".facility-cluster").evaluateAll((items) =>
    items.map((item) => ({
      size: Number((item as HTMLElement).dataset.count),
      text: item.lastElementChild?.textContent ?? "",
      label: item.getAttribute("aria-label") ?? "",
      overflow:
        item.scrollWidth > item.clientWidth + 1 ||
        item.scrollHeight > item.clientHeight + 1,
    })),
  );
  expect(clusters.length).toBeGreaterThan(0);
  for (const cluster of clusters) {
    const [size, ...parts] = cluster.text.split(" · ");
    expect(Number(size)).toBe(cluster.size);
    expect(
      parts.reduce((sum, part) => sum + Number(part.split(" ")[0]), 0),
    ).toBe(cluster.size);
    expect(cluster.label.startsWith(cluster.text)).toBe(true);
    expect(cluster.overflow).toBe(false);
  }
  await noSeriousAxe(page);
});

test("the app has a favicon and no favicon request fails", async ({ page }) => {
  const failed: string[] = [];
  page.on("response", (response) => {
    if (/favicon|icon/.test(response.url()) && response.status() >= 400)
      failed.push(response.url());
  });
  await page.goto("http://localhost:3300/");
  const href = await page
    .locator('link[rel="icon"]')
    .first()
    .getAttribute("href");
  expect(href).toBeTruthy();
  const icon = await page.request.get(
    new URL(href!, "http://localhost:3300/").href,
  );
  expect(icon.status()).toBe(200);
  expect(icon.headers()["content-type"]).toContain("image/svg+xml");
  expect(failed).toEqual([]);
});
