import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "Dawa Fire Drill" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#content">
          Skip to content
        </a>
        <div className="shell">
          <aside className="sidebar" aria-label="Primary navigation">
            <a className="brand" href="/">
              Dawa Fire Drill
            </a>
            <nav aria-label="Primary">
              <a href="/" aria-current="page">
                Overview
              </a>
            </nav>
            <p>
              Synthetic examples only.
              <br />
              Illustrative and unvalidated.
            </p>
          </aside>
          <div className="workspace">
            <header className="topbar">
              Kenya · County planning workspace
            </header>
            <div className="synthetic-banner" role="note">
              <strong>Synthetic demo data</strong> · Calibrated to public
              aggregates · Results are illustrative, not validated.
            </div>
            <main id="content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
