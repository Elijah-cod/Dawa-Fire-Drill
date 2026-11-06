# Static design prototype

Open `index.html` in a browser. Navigation links switch between ten key screens and the mobile map sheet. The prototype uses only HTML and CSS; form controls do not save, simulate, rank, upload, or sync data. It is a Phase 1 review artifact, not the product frontend.

The two numeric shock inputs (40% logistics support drop and 45-day cash delay) come from the user's brief. Other domain quantities remain placeholders until the synthetic dataset and its public-aggregate calibration are documented.

Run `cd apps/web && npm run test:design-prototype` to verify all 11 views at 360, 390, 768, 1024, 1280, and 1536px. The script checks horizontal overflow, banner visibility, one heading per view, labeled form controls, and mobile navigation. It also checks dark colors at 390 and 1280px. It renders Overview, Results, and Capture screenshots at the four requested test widths in a temporary directory, which it removes after the check; approved screenshots remain untouched.

Representative captures: [Overview mobile](overview-390.png), [Overview mobile dark](overview-dark-390.png), [Results desktop](results-1280.png), [Capture mobile](capture-390.png).
