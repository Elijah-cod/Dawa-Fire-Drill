// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FundingTrace } from "./funding-trace";

afterEach(cleanup);

const flow = {
  id: "SYN-042-FLOW-01",
  approved: 100000,
  released: 0,
  approved_on: "2025-01-01",
  as_of: "2025-04-01",
  synthetic: true,
};
const stalled = {
  synthetic: true,
  notice: "Illustrative and unvalidated",
  currency: "KES",
  bottlenecks: [
    { stage: "released_not_procured", amount: 2000, age_days: 10 },
    { stage: "approved_not_released", amount: 100000, age_days: 90 },
  ],
};

it("shows the four synthetic stages and ages delayed amounts oldest first", async () => {
  const trace = vi.fn().mockResolvedValue(stalled);
  render(<FundingTrace flow={flow} trace={trace} />);
  expect(screen.getByText(/tracing funding stages/i)).toBeTruthy();
  expect(screen.getByText(/synthetic funding flow/i)).toBeTruthy();
  const stages = screen.getAllByRole("listitem").slice(0, 4);
  expect(stages.map((item) => item.textContent)).toEqual([
    "Approved · 100,000 KES",
    "Released · 0 KES",
    "Procured · 0 KES",
    "Delivered · 0 KES",
  ]);
  await screen.findByText(/delayed amounts, oldest first/i);
  const ageing = screen.getAllByRole("listitem").slice(4);
  expect(ageing[0].textContent).toMatch(
    /Approved, not released · 100,000 KES · 90 days waiting/,
  );
  expect(ageing[1].textContent).toMatch(/Released, not procured · 2,000 KES/);
  expect(trace).toHaveBeenCalledWith("SYN-042-FLOW-01", "2025-04-01");
});

it("shows the selected bottleneck's details", async () => {
  render(
    <FundingTrace flow={flow} trace={vi.fn().mockResolvedValue(stalled)} />,
  );
  const button = await screen.findByRole("button", {
    name: /inspect bottleneck: approved, not released/i,
  });
  fireEvent.click(button);
  expect(button.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("Selected bottleneck")).toBeTruthy();
  expect(screen.getByText("2025-01-01")).toBeTruthy();
  expect(screen.getByText(/90 · As of 2025-04-01/)).toBeTruthy();
});

it("reports an empty synthetic view", async () => {
  render(
    <FundingTrace
      flow={flow}
      trace={vi.fn().mockResolvedValue({ ...stalled, bottlenecks: [] })}
    />,
  );
  expect(
    await screen.findByText(/no delayed flows in this synthetic view/i),
  ).toBeTruthy();
});

it("offers a retry after an error", async () => {
  const trace = vi
    .fn()
    .mockRejectedValueOnce(new Error("down"))
    .mockResolvedValue(stalled);
  render(<FundingTrace flow={flow} trace={trace} />);
  expect(await screen.findByText(/funding trace unavailable/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /try again/i }));
  expect(await screen.findByText(/90 days waiting/)).toBeTruthy();
});

it("keeps the stage summary and skips the request while offline", () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "onLine");
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  const trace = vi.fn();
  try {
    render(<FundingTrace flow={flow} trace={trace} />);
    expect(screen.getByText(/showing saved funding summary/i)).toBeTruthy();
    expect(screen.getByText("Approved · 100,000 KES")).toBeTruthy();
    expect(trace).not.toHaveBeenCalled();
  } finally {
    if (original) Object.defineProperty(navigator, "onLine", original);
    else Reflect.deleteProperty(navigator, "onLine");
  }
});
