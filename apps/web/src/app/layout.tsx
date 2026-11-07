import type { ReactNode } from "react";
import { AppShell } from "../components/app-shell";
import { PreferencesProvider } from "../preferences/preferences";
import "./globals.css";

export const metadata = { title: "Dawa Fire Drill" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PreferencesProvider>
          <AppShell>{children}</AppShell>
        </PreferencesProvider>
      </body>
    </html>
  );
}
