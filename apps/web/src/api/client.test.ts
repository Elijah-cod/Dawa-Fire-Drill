import { afterEach, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "./client";

afterEach(() => vi.unstubAllGlobals());

it("loads a typed national overview through the same-origin proxy", async () => {
  const send = vi
    .fn()
    .mockResolvedValue(
      Response.json({ synthetic: true, notice: "Illustrative", items: [] }),
    );
  vi.stubGlobal("fetch", send);
  const result = await createApiClient().overview(42, "national");
  expect(result.synthetic).toBe(true);
  expect(send.mock.calls[0][0]).toBe("/api/counties/overview?seed=42");
  const headers = send.mock.calls[0][1].headers as Headers;
  expect(headers.get("authorization")).toBeNull();
  expect(headers.get("x-demo-role")).toBe("national");
});

it("preserves session errors for the auth provider", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({}, { status: 401 })),
  );
  await expect(createApiClient().session()).rejects.toMatchObject({
    status: 401,
  });
  await expect(createApiClient().session()).rejects.toBeInstanceOf(ApiError);
});

it("requests the Kisumu pilot through the county-scoped proxy", async () => {
  const send = vi.fn().mockResolvedValue(
    Response.json({
      synthetic: true,
      county_code: "042",
      facilities: [],
      subcounties: [],
      commodities: [],
      stock: [],
      consumption: [],
    }),
  );
  vi.stubGlobal("fetch", send);
  const result = await createApiClient().pilot(42, "planner");
  expect(result.county_code).toBe("042");
  expect(send.mock.calls[0][0]).toBe("/api/counties/042/pilot?seed=42");
});

it("rejects pilot responses outside the synthetic Kisumu scope", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ synthetic: true, county_code: "047" }),
      ),
  );
  await expect(createApiClient().pilot(42, "planner")).rejects.toThrow(
    "Invalid synthetic pilot",
  );
});

it("rejects an incomplete pilot payload", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ synthetic: true, county_code: "042" }),
      ),
  );
  await expect(createApiClient().pilot(42, "planner")).rejects.toThrow(
    "Invalid synthetic pilot",
  );
});

it("submits an idempotent county-scoped scenario without a browser token", async () => {
  const send = vi
    .fn()
    .mockResolvedValue(Response.json({ id: "run", status: "queued" }));
  vi.stubGlobal("fetch", send);
  const request = {
    name: "Synthetic shock",
    shock_type: "logistics_reduction" as const,
    magnitude: 40,
    seed: 42,
    horizon_days: 90,
  };
  await createApiClient().submitRun(request, "request-1", "planner");
  expect(send.mock.calls[0][0]).toBe("/api/counties/042/runs");
  const init = send.mock.calls[0][1] as RequestInit;
  expect(init.method).toBe("POST");
  expect((init.headers as Headers).get("Idempotency-Key")).toBe("request-1");
  expect((init.headers as Headers).get("Authorization")).toBeNull();
});

it("rejects a facility response that does not match the requested facility", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        synthetic: true,
        county_code: "042",
        facility: { id: "OTHER" },
      }),
    ),
  );
  await expect(
    createApiClient().facility("SYN-KE-042-F001", 42, "facility"),
  ).rejects.toThrow("Invalid synthetic facility");
});

it("requests a county-scoped optimizer result without a browser token", async () => {
  const send = vi.fn().mockResolvedValue(Response.json({ synthetic: true }));
  vi.stubGlobal("fetch", send);
  const body = {
    synthetic_attested: true as const,
    budget: 100,
    minimum_benefit: 1,
    candidates: [],
  };
  await createApiClient().rank("run-1", body, "planner");
  expect(send.mock.calls[0][0]).toBe(
    "/api/counties/042/runs/run-1/mitigations",
  );
  const init = send.mock.calls[0][1] as RequestInit;
  expect(init.method).toBe("POST");
  expect((init.headers as Headers).get("Authorization")).toBeNull();
  expect(JSON.parse(String(init.body))).toEqual(body);
});

it("requests the synthetic funding trace through the county-scoped proxy", async () => {
  const send = vi.fn().mockResolvedValue(
    Response.json({
      synthetic: true,
      notice: "Illustrative and unvalidated",
      currency: "KES",
      bottlenecks: [
        { stage: "approved_not_released", amount: 100000, age_days: 90 },
      ],
    }),
  );
  vi.stubGlobal("fetch", send);
  const result = await createApiClient().fundingTrace(
    "SYN-042-FLOW-01",
    "2025-04-01",
    "planner",
  );
  expect(result.bottlenecks[0].age_days).toBe(90);
  expect(send.mock.calls[0][0]).toBe(
    "/api/counties/042/funding/SYN-042-FLOW-01/trace?seed=42&as_of=2025-04-01",
  );
});

it("rejects a funding trace that is not synthetic or is malformed", async () => {
  for (const body of [
    { synthetic: false, currency: "KES", bottlenecks: [] },
    { synthetic: true, currency: "USD", bottlenecks: [] },
    {
      synthetic: true,
      currency: "KES",
      bottlenecks: [{ stage: "approved_not_released", amount: "lots" }],
    },
  ]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
    await expect(
      createApiClient().fundingTrace("SYN-042-FLOW-01", "2025-04-01"),
    ).rejects.toThrow("Invalid funding trace");
  }
});

it("uploads a synthetic bin card as multipart with the facility demo role", async () => {
  const send = vi.fn().mockResolvedValue(
    Response.json({
      id: "capture-1",
      facility_id: "SYN-KE-042-F001",
      fields: {},
      status: "pending",
      synthetic: true,
    }),
  );
  vi.stubGlobal("fetch", send);
  const file = new File(["png"], "card.png", { type: "image/png" });
  await createApiClient().uploadCapture(
    "SYN-KE-042-F001",
    file,
    "key-1",
    "facility",
  );
  const [url, init] = send.mock.calls[0];
  expect(url).toBe(
    "/api/counties/042/facilities/SYN-KE-042-F001/captures?seed=42",
  );
  expect(init.headers.get("Idempotency-Key")).toBe("key-1");
  expect(init.headers.get("X-Demo-Role")).toBe("facility");
  expect(init.body.get("synthetic_attested")).toBe("true");
  expect(init.body.get("file")).toBeInstanceOf(File);
});

it("rejects a capture or confirmation for another facility", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        id: "capture-1",
        facility_id: "SYN-KE-042-F002",
        fields: {},
        synthetic: true,
      }),
    ),
  );
  await expect(
    createApiClient().uploadCapture(
      "SYN-KE-042-F001",
      new File(["png"], "card.png", { type: "image/png" }),
      "key-1",
    ),
  ).rejects.toThrow("Invalid synthetic capture");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        synthetic: true,
        capture_id: "capture-1",
        facility_id: "SYN-KE-042-F002",
        fields: {},
      }),
    ),
  );
  await expect(
    createApiClient().confirmCapture("SYN-KE-042-F001", "capture-1", {
      commodity_name: "Synthetic tracer",
      opening_balance: 1,
      closing_balance: 1,
      record_date: "2026-11-01",
    }),
  ).rejects.toThrow("Invalid capture confirmation");
});
