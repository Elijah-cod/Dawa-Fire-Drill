"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Role = "planner" | "pharmacist" | "facility" | "admin";
export type Session = { role: Role; expiresAt: number };
export type AuthState =
  { status: "missing" | "expired" } | { status: "authenticated"; role: Role };

const AuthContext = createContext<AuthState>({ status: "missing" });

export function AuthProvider({
  session,
  children,
}: {
  session: Session | null;
  children: ReactNode;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!session || session.expiresAt <= Date.now()) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      session.expiresAt - Date.now(),
    );
    return () => clearTimeout(timer);
  }, [session]);
  const value: AuthState = !session
    ? { status: "missing" }
    : session.expiresAt <= now
      ? { status: "expired" }
      : { status: "authenticated", role: session.role };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
