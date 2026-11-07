// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { AuthProvider, useAuth } from "./auth-provider";

afterEach(cleanup);

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

it("loads a session through an adapter without exposing credentials", async () => {
  const adapter = {
    load: async () => ({
      status: "authenticated" as const,
      role: "planner" as const,
    }),
  };
  render(
    <AuthProvider adapter={adapter}>
      <ReadSession />
    </AuthProvider>,
  );
  expect(await screen.findByText("planner")).toBeTruthy();
});

it("does not retain the previous role while a changed adapter loads", async () => {
  const first = {
    load: async () => ({
      status: "authenticated" as const,
      role: "planner" as const,
    }),
  };
  const second = { load: () => new Promise<never>(() => {}) };
  const { rerender } = render(
    <AuthProvider adapter={first}>
      <ReadSession />
    </AuthProvider>,
  );
  expect(await screen.findByText("planner")).toBeTruthy();
  rerender(
    <AuthProvider adapter={second}>
      <ReadSession />
    </AuthProvider>,
  );
  expect(screen.getByText("loading")).toBeTruthy();
  expect(screen.queryByText("planner")).toBeNull();
});
