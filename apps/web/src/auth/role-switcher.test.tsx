// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RoleSwitcher } from "./role-switcher";

afterEach(cleanup);

it("appears only when the backend reports switching is enabled", () => {
  const select = vi.fn();
  const { rerender } = render(
    <RoleSwitcher enabled={false} value="national" onChange={select} />,
  );
  expect(screen.queryByLabelText(/demo role/i)).toBeNull();
  rerender(<RoleSwitcher enabled value="national" onChange={select} />);
  fireEvent.change(screen.getByLabelText(/demo role/i), {
    target: { value: "facility" },
  });
  expect(select).toHaveBeenCalledWith("facility");
});
