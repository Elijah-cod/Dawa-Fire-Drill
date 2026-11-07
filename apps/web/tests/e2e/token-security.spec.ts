import { expect, test } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const canary = "synthetic-build-canary-token";

async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const name = path.join(directory, entry.name);
        return entry.isDirectory() ? files(name) : [name];
      }),
    )
  ).flat();
}

test("the synthetic server token stays out of client assets, storage and responses", async ({
  page,
}) => {
  for (const file of await files(path.join(process.cwd(), ".next", "static"))) {
    expect((await readFile(file)).includes(canary)).toBe(false);
  }
  const bodies: Promise<string>[] = [];
  page.on("requestfinished", (request) => {
    if (request.url().startsWith("http://localhost:3300/")) {
      bodies.push(
        request.response().then((response) => response?.text() ?? ""),
      );
    }
  });
  await page.goto("http://localhost:3300/");
  const proxyStatus = await page.evaluate(async () => {
    const response = await fetch("/api/counties/overview?seed=42");
    await response.text();
    return response.status;
  });
  expect(proxyStatus).not.toBe(503);
  for (const body of await Promise.all(bodies))
    expect(body).not.toContain(canary);
  const storage = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  );
  expect(storage).not.toContain(canary);
});
