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
