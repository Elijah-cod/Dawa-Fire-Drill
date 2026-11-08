/* global document, process, console */
import { writeFile } from "node:fs/promises";
import { startFlow } from "lighthouse";
import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto("http://localhost:3300/kisumu", {
    waitUntil: "networkidle2",
  });
  await page.waitForSelector("#shock-slider:not([disabled])");
  const flow = await startFlow(page, { name: "Synthetic Kisumu ranked fix" });
  await flow.startTimespan({ stepName: "Run shock and rank fixes" });
  await page.focus("#shock-slider");
  await page.keyboard.press("Home");
  for (let i = 0; i < 40; i++) await page.keyboard.press("ArrowRight");
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("button")].some((element) =>
        element.textContent?.includes("Rank feasible actions"),
      ),
    { timeout: 30000 },
  );
  const action = await page.evaluateHandle(() =>
    [...document.querySelectorAll("button")].find((element) =>
      element.textContent?.includes("Rank feasible actions"),
    ),
  );
  await action.asElement().click();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("h3")].some((element) =>
        element.textContent?.includes("Plain-language explanation"),
      ),
    { timeout: 30000 },
  );
  await flow.endTimespan();
  await flow.snapshot({ stepName: "Ranked fixes visible" });
  const result = await flow.createFlowResult();
  await writeFile(
    ".lighthouseci/ranked-flow.json",
    JSON.stringify(result, null, 2),
  );
  await writeFile(
    ".lighthouseci/ranked-flow.html",
    await flow.generateReport(),
  );
  for (const step of result.steps) {
    const scores = Object.fromEntries(
      Object.entries(step.lhr.categories).map(([name, category]) => [
        name,
        category.score,
      ]),
    );
    console.log(step.name, JSON.stringify(scores));
    if (scores.accessibility !== undefined && scores.accessibility < 0.9)
      throw new Error("Ranked-state accessibility budget failed");
    if (
      scores["best-practices"] !== undefined &&
      scores["best-practices"] < 0.9
    )
      throw new Error("Ranked-state best-practices budget failed");
    if (scores.performance !== undefined && scores.performance < 0.8)
      throw new Error("Ranked-flow performance budget failed");
  }
} finally {
  await browser.close();
}
