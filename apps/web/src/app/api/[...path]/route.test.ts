import { afterEach, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("keeps the demo token server-side and rejects a response that echoes it", async () => {
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv("DEMO_API_TOKEN", "synthetic-test-only-token");
  vi.stubEnv("API_INTERNAL_URL", "http://localhost:8000/v1");
  const upstream = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ notice: "synthetic-test-only-token" }), {
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", upstream);
  const response = await GET(
    new Request("http://localhost/api/counties/overview"),
    {
      params: Promise.resolve({ path: ["counties", "overview"] }),
    },
  );
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("synthetic-test-only-token");
  expect(upstream.mock.calls[0][1].headers.get("Authorization")).toBe(
    "Bearer synthetic-test-only-token",
  );
});

it("fails closed when the server token is absent or production is selected", async () => {
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("DEMO_API_TOKEN", "synthetic-test-only-token");
  const response = await GET(
    new Request("http://localhost/api/counties/overview"),
    {
      params: Promise.resolve({ path: ["counties", "overview"] }),
    },
  );
  expect(response.status).toBe(503);
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv("DEMO_API_TOKEN", "");
  expect(
    (
      await GET(new Request("http://localhost/api/counties/overview"), {
        params: Promise.resolve({ path: ["counties", "overview"] }),
      })
    ).status,
  ).toBe(503);
});

it("refuses role switching unless the backend explicitly enables it", async () => {
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv("DEMO_API_TOKEN", "synthetic-test-only-token");
  vi.stubEnv("API_INTERNAL_URL", "http://localhost:8000/v1");
  const upstream = vi
    .fn()
    .mockResolvedValue(Response.json({ role_switcher: false }));
  vi.stubGlobal("fetch", upstream);
  const response = await GET(
    new Request("http://localhost/api/counties/overview", {
      headers: { "x-demo-role": "national" },
    }),
    { params: Promise.resolve({ path: ["counties", "overview"] }) },
  );
  expect(response.status).toBe(403);
  expect(upstream).toHaveBeenCalledTimes(1);
});

it("forwards an enabled demo role without forwarding browser credentials", async () => {
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv("DEMO_API_TOKEN", "synthetic-test-only-token");
  vi.stubEnv("API_INTERNAL_URL", "http://localhost:8000/v1");
  const upstream = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ role_switcher: true }))
    .mockResolvedValueOnce(Response.json({ synthetic: true }));
  vi.stubGlobal("fetch", upstream);
  const response = await GET(
    new Request("http://localhost/api/counties/overview?seed=42", {
      headers: {
        "x-demo-role": "national",
        authorization: "Bearer untrusted-browser-value",
      },
    }),
    { params: Promise.resolve({ path: ["counties", "overview"] }) },
  );
  expect(response.status).toBe(200);
  const headers = upstream.mock.calls[1][1].headers as Headers;
  expect(headers.get("authorization")).toBe("Bearer synthetic-test-only-token");
  expect(headers.get("x-demo-role")).toBe("national");
  expect(await response.text()).not.toContain("synthetic-test-only-token");
});
