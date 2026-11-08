import type { ReactNode } from "react";
import { AppShell } from "../components/app-shell";
import { PreferencesProvider } from "../preferences/preferences";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata = { title: "Dawa Fire Drill" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/source-serif-4-latin-600-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
      </head>
      <body>
        <PreferencesProvider>
          <AppShell>{children}</AppShell>
        </PreferencesProvider>
      </body>
    </html>
  );
}
