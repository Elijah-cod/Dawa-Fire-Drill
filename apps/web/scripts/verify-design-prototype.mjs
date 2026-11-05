/* global console, document, getComputedStyle, innerWidth */
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const prototype = resolve(
  import.meta.dirname,
  "../../../docs/design/prototype/index.html",
);
const url = pathToFileURL(prototype).href;
const routes = [
  "overview",
  "scenario",
  "progress",
  "results",
  "actions",
  "funding",
  "stock",
  "redistribution",
  "capture",
  "facility",
  "map-sheet",
];
const widths = [360, 390, 768, 1024, 1280, 1536];
const browser = await chromium.launch({ headless: true });
let checked = 0;

try {
  for (const width of widths) {
    const page = await browser.newPage({
      viewport: { width, height: width < 768 ? 844 : 900 },
    });
    for (const route of routes) {
      await page.goto(`${url}#${route}`);
      const result = await page.evaluate(
        (id) => ({
          overflow: document.documentElement.scrollWidth - innerWidth,
          banner:
            getComputedStyle(document.querySelector(".synthetic-banner"))
              .display !== "none",
          screen:
            getComputedStyle(document.getElementById(id)).display !== "none",
          mobileNav:
            getComputedStyle(document.querySelector(".bottom-nav")).display !==
            "none",
          heading:
            document.getElementById(id).querySelectorAll("h1").length === 1,
          labeledInputs: [
            ...document.getElementById(id).querySelectorAll("input, select"),
          ].every((input) => !!input.closest("label")),
        }),
        route,
      );
      if (
        result.overflow > 1 ||
        !result.banner ||
        !result.screen ||
        !result.heading ||
        !result.labeledInputs ||
        result.mobileNav !== width < 768
      ) {
        const overflowing = await page.evaluate(() =>
          [...document.querySelectorAll("body *")]
            .filter(
              (element) =>
                element.getBoundingClientRect().right > innerWidth + 1,
            )
            .slice(0, 8)
            .map((element) => `${element.tagName}.${element.className}`),
        );
        throw new Error(
          `${width} ${route}: ${JSON.stringify(result)} ${overflowing.join(", ")}`,
        );
      }
      checked++;
    }
    if ([390, 768, 1280, 1536].includes(width)) {
      for (const route of ["overview", "results", "capture"]) {
        await page.goto(`${url}#${route}`);
        await page.screenshot({
          path: resolve(
            import.meta.dirname,
            `../../../docs/design/prototype/${route}-${width}.png`,
          ),
          fullPage: true,
        });
      }
    }
    await page.close();
  }
  for (const width of [390, 1280]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      colorScheme: "dark",
    });
    await page.goto(`${url}#overview`);
    const colors = await page.evaluate(() => ({
      canvas: getComputedStyle(document.body).backgroundColor,
      ink: getComputedStyle(document.body).color,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }));
    if (
      colors.canvas !== "rgb(15, 27, 34)" ||
      colors.ink !== "rgb(246, 247, 242)" ||
      colors.overflow > 1
    ) {
      throw new Error(`dark ${width}: ${JSON.stringify(colors)}`);
    }
    await page.screenshot({
      path: resolve(
        import.meta.dirname,
        `../../../docs/design/prototype/overview-dark-${width}.png`,
      ),
      fullPage: true,
    });
    await page.close();
  }
  console.log(
    `prototype checks passed: ${checked} screen/width combinations and 2 dark-theme checks`,
  );
} finally {
  await browser.close();
}
