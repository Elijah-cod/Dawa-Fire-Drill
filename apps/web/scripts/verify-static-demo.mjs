/* global console, process, fetch, setTimeout, URL */
/**
 * Builds the static public demo (STATIC_DEMO=1) into .next-static and checks that it is safe
 * to publish: the build refuses to run when a server-side token or secret is set, the output
 * has no API proxy route and no token, and the pages work from bundled fixtures without any
 * request to /api. Synthetic data only. Usage, from apps/web: npm run test:static-demo
 */
import { spawn, spawnSync } from "node:child_process";
import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const dist = ".next-static";
const port = 3400;
const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
  if (!ok) failures.push(message);
};
// A clean environment: no server-side settings, whatever the caller's shell holds.
const secrets = [
  "DEMO_API_TOKEN",
  "E2E_DEMO_TOKEN",
  "API_INTERNAL_URL",
  "SUPABASE_JWT_SECRET",
  "SUPABASE_URL",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
];
const env = { ...process.env, STATIC_DEMO: "1", NEXT_DIST_DIR: dist };
for (const name of secrets) delete env[name];

// Building into a second dist directory makes Next.js add its type paths to tsconfig.json;
// keep the committed file unchanged.
const tsconfig = await readFile("tsconfig.json", "utf8");
const restoreTsconfig = () => writeFile("tsconfig.json", tsconfig);

// 1. The build refuses to run when a server-side token is present.
const refused = spawnSync("npx", ["next", "build", "--webpack"], {
  env: { ...env, DEMO_API_TOKEN: "synthetic.canary.value" },
  encoding: "utf8",
});
check(
  refused.status !== 0 &&
    `${refused.stdout}${refused.stderr}`.includes(
      "Refusing to build or start the static demo",
    ),
  "build refuses to run when DEMO_API_TOKEN is set",
);

// 2. Build the static demo.
await rm(dist, { recursive: true, force: true });
const build = spawnSync("npx", ["next", "build", "--webpack"], {
  env,
  encoding: "utf8",
});
await restoreTsconfig();
check(build.status === 0, "static demo build succeeds");
if (build.status !== 0) {
  console.error(build.stdout.slice(-2000), build.stderr.slice(-2000));
  process.exit(1);
}

// 3. No proxy route in the output.
const exists = (path) =>
  stat(path).then(
    () => true,
    () => false,
  );
check(
  !(await exists(join(dist, "server/app/api"))),
  "no server/app/api in the build",
);
const manifest = await readFile(
  join(dist, "app-path-routes-manifest.json"),
  "utf8",
);
check(
  !manifest.includes("/api"),
  "no /api route in app-path-routes-manifest.json",
);

// 4. No token or token-shaped value anywhere in the output.
async function* files(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "cache") yield* files(path);
    } else yield path;
  }
}
const jwt = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;
const leaks = [];
for await (const path of files(dist)) {
  const text = await readFile(path, "utf8").catch(() => "");
  if (jwt.test(text) || text.includes("synthetic.canary.value"))
    leaks.push(path);
}
check(
  leaks.length === 0,
  `no token-shaped value in the build (${leaks.join(", ") || "none"})`,
);

// 5. Starting the built demo also refuses when a server-side token is present.
const refusedStart = spawnSync(
  "npx",
  ["next", "start", "-p", String(port + 1)],
  {
    env: { ...env, E2E_DEMO_TOKEN: "synthetic.canary.value" },
    encoding: "utf8",
    timeout: 60000,
  },
);
check(
  refusedStart.status !== 0 &&
    `${refusedStart.stdout}${refusedStart.stderr}`.includes(
      "Refusing to build or start the static demo",
    ),
  "start refuses to run when E2E_DEMO_TOKEN is set",
);

// 6. Serve it and use it from fixtures only.
const server = spawn("npx", ["next", "start", "-p", String(port)], {
  env,
  stdio: "ignore",
});
try {
  let up = false;
  for (let attempt = 0; attempt < 60 && !up; attempt++) {
    up = await fetch(`http://localhost:${port}/kisumu`).then(
      (response) => response.ok,
      () => false,
    );
    if (!up) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  check(up, "static demo serves /kisumu");
  const proxy = await fetch(`http://localhost:${port}/api/demo/session`);
  check(
    proxy.status === 404,
    `GET /api/demo/session returns 404 (got ${proxy.status})`,
  );

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const apiCalls = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/") || url.port === "8000")
      apiCalls.push(url.href);
  });
  await page.goto(`http://localhost:${port}/`);
  await page
    .getByText("Static synthetic demo")
    .first()
    .waitFor({ timeout: 30000 });
  check(true, "banner says it is a static synthetic demo");
  check(
    (await page.getByLabel("Demo role").count()) === 0,
    "no role switcher on the overview",
  );
  await page.goto(`http://localhost:${port}/kisumu`);
  await page
    .locator("#verdict")
    .getByText("209 stockouts")
    .waitFor({ timeout: 30000 });
  await page
    .locator("#budget-status")
    .getByText("30 of 30 units used.")
    .waitFor({ timeout: 30000 });
  check(
    true,
    "Kisumu verdict and ranking render from fixtures (209 stockouts, 30 of 30 units)",
  );
  check(
    (await page.getByLabel("Demo role").count()) === 0,
    "no role switcher on Kisumu",
  );
  await page.goto(`http://localhost:${port}/kisumu?view=capture`);
  await page.locator("#capture-title").waitFor({ timeout: 30000 });
  check(true, "bin-card capture view renders from fixtures");
  check(
    apiCalls.length === 0,
    `no request to /api or the backend (${apiCalls.length})`,
  );
  await browser.close();
} finally {
  server.kill();
}

if (failures.length) {
  console.error(`${failures.length} static demo check(s) failed`);
  process.exit(1);
}
console.log("static demo checks passed");
