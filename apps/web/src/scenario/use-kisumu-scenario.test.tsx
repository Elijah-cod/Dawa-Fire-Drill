// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useKisumuScenario } from "./use-kisumu-scenario";

afterEach(cleanup);

it("loads a baseline and updates the selected run when the shock changes", async () => {
  const api = {
    submit: vi.fn(async (magnitude: number) => ({
      id: String(magnitude),
      status: "succeeded",
      result: { synthetic: true, county_code: "042", stockouts: [] },
      horizon_days: 90,
    })),
    read: vi.fn(),
  };
  const { result } = renderHook(() => useKisumuScenario(api));
  await waitFor(() => expect(result.current.run?.id).toBe("0"));
  act(() => result.current.setMagnitude(40));
  await waitFor(() => expect(result.current.run?.id).toBe("40"));
  expect(api.submit).toHaveBeenCalledWith(0, expect.any(String));
  expect(api.submit).toHaveBeenCalledWith(40, expect.any(String));
});

it("does not replace a newer scenario with a late older result", async () => {
  let finishBaseline:
    | ((value: {
        id: string;
        status: string;
        result: Record<string, unknown>;
        horizon_days: number;
      }) => void)
    | undefined;
  const baseline = new Promise<{
    id: string;
    status: string;
    result: Record<string, unknown>;
    horizon_days: number;
  }>((resolve) => {
    finishBaseline = resolve;
  });
  const api = {
    submit: vi.fn((magnitude: number) =>
      magnitude === 0
        ? baseline
        : Promise.resolve({
            id: "40",
            status: "succeeded",
            result: { synthetic: true },
            horizon_days: 90,
          }),
    ),
    read: vi.fn(),
  };
  const { result } = renderHook(() => useKisumuScenario(api));
  await waitFor(() => expect(api.submit).toHaveBeenCalledTimes(1));
  act(() => result.current.setMagnitude(40));
  await waitFor(() => expect(result.current.run?.id).toBe("40"));
  await act(async () => {
    finishBaseline?.({
      id: "0",
      status: "succeeded",
      result: { synthetic: true },
      horizon_days: 90,
    });
  });
  expect(result.current.run?.id).toBe("40");
});

it("does not submit a run for a read-only role", async () => {
  const api = { submit: vi.fn(), read: vi.fn() };
  const { result } = renderHook(() => useKisumuScenario(api, false));
  expect(result.current.status).toBe("idle");
  expect(api.submit).not.toHaveBeenCalled();
});
