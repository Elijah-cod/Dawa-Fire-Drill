// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { AuthProvider, useAuth } from "./auth-provider";

function ReadSession() {
  const auth = useAuth();
  return <p>{auth.status === "authenticated" ? auth.role : auth.status}</p>;
}

it.each(["planner", "pharmacist", "facility", "admin"] as const)(
  "exposes the %s role from a mock session",
  (role) => {
    render(
      <AuthProvider session={{ role, expiresAt: Date.now() + 60000 }}>
        <ReadSession />
      </AuthProvider>,
    );
    expect(screen.getByText(role)).toBeTruthy();
  },
);

it("distinguishes missing and expired sessions", () => {
  const { rerender } = render(
    <AuthProvider session={null}>
      <ReadSession />
    </AuthProvider>,
  );
  expect(screen.getByText("missing")).toBeTruthy();
  rerender(
    <AuthProvider session={{ role: "planner", expiresAt: 0 }}>
      <ReadSession />
    </AuthProvider>,
  );
  expect(screen.getByText("expired")).toBeTruthy();
});
