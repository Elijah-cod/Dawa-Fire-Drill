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
  | { status: "loading" | "missing" | "expired" | "error" }
  | {
      status: "authenticated";
      role: Role;
      canSwitchRoles?: boolean;
      nationalPlanning?: boolean;
      countyCode?: string | null;
      facilityId?: string | null;
    };
export type AuthAdapter = { load: () => Promise<AuthState> };

const AuthContext = createContext<AuthState>({ status: "missing" });

export function AuthProvider({
  session,
  adapter,
  children,
}: {
  session?: Session | null;
  adapter?: AuthAdapter;
  children: ReactNode;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [remote, setRemote] = useState<{
    adapter: AuthAdapter;
    value: AuthState;
  } | null>(null);
  useEffect(() => {
    if (!adapter) return;
    let active = true;
    adapter.load().then(
      (value) => {
        if (active) setRemote({ adapter, value });
      },
      () => {
        if (active) setRemote({ adapter, value: { status: "error" } });
      },
    );
    return () => {
      active = false;
    };
  }, [adapter]);
  useEffect(() => {
    if (!session || session.expiresAt <= Date.now()) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      session.expiresAt - Date.now(),
    );
    return () => clearTimeout(timer);
  }, [session]);
  const value: AuthState = adapter
    ? remote?.adapter === adapter
      ? remote.value
      : { status: "loading" }
    : !session
      ? { status: "missing" }
      : session.expiresAt <= now
        ? { status: "expired" }
        : { status: "authenticated", role: session.role };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
