// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BinCardCapture } from "./bin-card-capture";

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:synthetic-card");
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const png = () =>
  new File([new Uint8Array([137, 80, 78, 71])], "card.png", {
    type: "image/png",
  });
const pending = (fields: Record<string, unknown>, provider = "extracted") => ({
  id: "capture-1",
  country_code: "KE",
  facility_id: "F001",
  fields,
  provider_status: provider,
  status: "pending" as const,
  created_at: "2026-11-08T00:00:00Z",
  synthetic: true,
  notice: "Synthetic",
});
const empty = {
  commodity_name: null,
  opening_balance: null,
  closing_balance: null,
  record_date: null,
};

function setup(upload = vi.fn(), confirm = vi.fn()) {
  render(
    <BinCardCapture facilityId="F001" upload={upload} confirm={confirm} />,
  );
  return { upload, confirm };
}
const readButton = () =>
  screen.getByRole("button", { name: "Read the card" }) as HTMLButtonElement;

it("requires a synthetic attestation and a supported image before reading", () => {
  setup();
  expect(screen.getByText("Add a clear photo of one bin card.")).toBeTruthy();
  expect(readButton().disabled).toBe(true);
  const input = screen.getByLabelText(/bin-card photo/i);
  fireEvent.change(input, {
    target: { files: [new File(["x"], "card.gif", { type: "image/gif" })] },
  });
  expect(screen.getByRole("alert").textContent).toMatch(/PNG, JPEG or WebP/);
  fireEvent.change(input, {
    target: {
      files: [
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", {
          type: "image/png",
        }),
      ],
    },
  });
  expect(screen.getByRole("alert").textContent).toMatch(/larger than 5 MB/);
  fireEvent.change(input, { target: { files: [png()] } });
  expect(readButton().disabled).toBe(true);
  fireEvent.click(screen.getByLabelText(/synthetic bin card with no real/i));
  expect(readButton().disabled).toBe(false);
});

it("saves only after the person reviews every field and confirms", async () => {
  const { upload, confirm } = setup(
    vi.fn().mockResolvedValue(pending(empty, "manual_unavailable")),
    vi.fn().mockImplementation(async (id, fields) => ({
      synthetic: true,
      capture_id: id,
      facility_id: "F001",
      fields,
    })),
  );
  fireEvent.click(screen.getByLabelText(/synthetic bin card with no real/i));
  fireEvent.change(screen.getByLabelText(/bin-card photo/i), {
    target: { files: [png()] },
  });
  fireEvent.click(readButton());
  expect(
    await screen.findByText(/automatic reading is unavailable/i),
  ).toBeTruthy();
  expect(screen.getByRole("img", { name: "Your bin-card photo" })).toBeTruthy();
  const review = screen.getByRole("button", {
    name: "Review and save",
  }) as HTMLButtonElement;
  expect(review.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Commodity name"), {
    target: { value: " Synthetic tracer " },
  });
  fireEvent.change(screen.getByLabelText("Opening balance (units)"), {
    target: { value: "40" },
  });
  fireEvent.change(screen.getByLabelText("Closing balance (units)"), {
    target: { value: "12" },
  });
  fireEvent.change(screen.getByLabelText("Record date"), {
    target: { value: "2026-11-01" },
  });
  fireEvent.click(review);
  const prompt = screen.getByRole("heading", {
    name: /save these values to this synthetic facility/i,
  });
  expect(document.activeElement).toBe(prompt);
  fireEvent.click(screen.getByRole("button", { name: "Go back" }));
  expect(
    screen.queryByRole("heading", { name: /save these values/i }),
  ).toBeNull();
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Review and save" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));
  expect(
    await screen.findByText(/saved to this synthetic facility/i),
  ).toBeTruthy();
  expect(confirm).toHaveBeenCalledWith("capture-1", {
    commodity_name: "Synthetic tracer",
    opening_balance: 40,
    closing_balance: 12,
    record_date: "2026-11-01",
  });
  expect(upload).toHaveBeenCalledWith(expect.any(File), expect.any(String));
});

it("prefills extracted values and highlights unclear ones", async () => {
  setup(
    vi
      .fn()
      .mockResolvedValue(
        pending({
          ...empty,
          commodity_name: "Synthetic tracer",
          opening_balance: 9,
        }),
      ),
  );
  fireEvent.click(screen.getByLabelText(/synthetic bin card with no real/i));
  fireEvent.change(screen.getByLabelText(/bin-card photo/i), {
    target: { files: [png()] },
  });
  fireEvent.click(readButton());
  expect(await screen.findByText(/some fields were unclear/i)).toBeTruthy();
  expect(
    (screen.getByLabelText("Commodity name") as HTMLInputElement).value,
  ).toBe("Synthetic tracer");
  expect(
    screen
      .getByLabelText("Closing balance (units)")
      .getAttribute("aria-invalid"),
  ).toBe("true");
  expect(
    screen
      .getByLabelText("Opening balance (units)")
      .getAttribute("aria-invalid"),
  ).toBeNull();
});

it("reuses the idempotency key when the same photo is retried after an error", async () => {
  const upload = vi
    .fn()
    .mockRejectedValueOnce(new Error("422"))
    .mockResolvedValue(pending(empty, "manual_unavailable"));
  setup(upload);
  fireEvent.click(screen.getByLabelText(/synthetic bin card with no real/i));
  fireEvent.change(screen.getByLabelText(/bin-card photo/i), {
    target: { files: [png()] },
  });
  fireEvent.click(readButton());
  expect(await screen.findByText(/could not read this image/i)).toBeTruthy();
  fireEvent.click(readButton());
  await screen.findByText(/automatic reading is unavailable/i);
  expect(upload.mock.calls[0][1]).toBe(upload.mock.calls[1][1]);
});

it("is online-only: no upload while offline", () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "onLine");
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false,
  });
  try {
    const { upload } = setup();
    expect(screen.getByText("Go online to upload a bin card.")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/synthetic bin card with no real/i));
    fireEvent.change(screen.getByLabelText(/bin-card photo/i), {
      target: { files: [png()] },
    });
    expect(readButton().disabled).toBe(true);
    fireEvent.click(readButton());
    expect(upload).not.toHaveBeenCalled();
  } finally {
    if (original) Object.defineProperty(navigator, "onLine", original);
    else Reflect.deleteProperty(navigator, "onLine");
  }
});
