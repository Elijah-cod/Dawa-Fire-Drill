/* global document, process, console, setTimeout */
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
  // Match Lighthouse's default mobile emulation so starting the timespan does
  // not resize the page and record a reflow as a layout shift.
  await page.setViewport({
    width: 412,
    height: 823,
    deviceScaleFactor: 1.75,
    isMobile: true,
    hasTouch: true,
  });
  await page.goto("http://localhost:3300/kisumu", {
    waitUntil: "networkidle2",
  });
  // The 40% shock runs and the first ranking (30 units) arrives without any input.
  await page.waitForFunction(
    () =>
      document.getElementById("budget-status")?.textContent ===
      "30 of 30 units used.",
    { timeout: 30000 },
  );
  const flow = await startFlow(page, { name: "Synthetic Kisumu ranked fix" });
  await flow.startTimespan({ stepName: "Move the budget and the timeline" });
  await page.focus("#budget");
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("ArrowRight");
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  await page.waitForFunction(
    () =>
      document.getElementById("budget-status")?.textContent ===
      "40 of 70 units used.",
    { timeout: 30000 },
  );
  for (let i = 0; i < 4; i++) {
    await page.click("#next-week");
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
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
    const shift = step.lhr.audits["cumulative-layout-shift"]?.numericValue;
    const inp = step.lhr.audits["interaction-to-next-paint"]?.numericValue;
    console.log(
      step.name,
      step.lhr.gatherMode,
      JSON.stringify(scores),
      shift === undefined ? "" : `CLS ${shift.toFixed(3)}`,
      inp === undefined ? "" : `INP ${inp} ms`,
    );
    if (scores.accessibility !== undefined && scores.accessibility < 0.9)
      throw new Error("Ranked-state accessibility budget failed");
    if (
      scores["best-practices"] !== undefined &&
      scores["best-practices"] < 0.9
    )
      throw new Error("Ranked-state best-practices budget failed");
    // Snapshot steps have no weighted performance audits, so Lighthouse reports
    // 0; the budget applies to the measured interaction (timespan) step.
    if (
      step.lhr.gatherMode !== "snapshot" &&
      scores.performance !== undefined &&
      scores.performance < 0.8
    )
      throw new Error("Ranked-flow performance budget failed");
  }
} finally {
  await browser.close();
}
