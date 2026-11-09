# Stage 2 report: repository hygiene

## Done

- **Licence:** added `LICENSE` (MIT, copyright 2026 Elijah Mathai) and `THIRD_PARTY_NOTICES.md` (Source Serif 4 under OFL 1.1, OpenStreetMap data under ODbL with the tile usage policy, MapLibre, key runtime dependencies and tools with licence types, local container images).
- **Moved to `docs/process/`** (`git mv`, history kept): `PRODUCT.md` → `product-brief.md`; `packages/shared/README.md` → `shared-types-note.md` (empty `packages/` removed); `docs/PROGRESS.md` → `PROGRESS.md`; `docs/phases/` → `phases/` (with its screenshots); `docs/design/critique-v2.md`, `critique-v3.md`, `critique-v4.md`, `APPROVAL.md`, `REVIEW.md`, `figma-checklist.md` → `design/`.
- **Links:** rewrote plain-text paths in `AGENTS.md`, `README.md`, `docs/process/PROGRESS.md` and `docs/process/phases/0.md` and `1.md`, and fixed 12 broken relative links found by a link check over every tracked Markdown file (0 broken afterwards). `docs/design/README.md` now points to the approval record instead of describing an open gate.
- **Dead code removed:** `peakWindow` in `apps/web/src/components/stockout-order.tsx` and its test (proof: `git grep peakWindow` matched only the definition and the test); 50 unused translation keys in both locales of `apps/web/src/preferences/preferences.tsx` (proof: no quoted reference in non-test sources under `apps/web/src`).
- **AGENTS.md:** rewritten as neutral engineering guidelines (truthfulness, secrets, Conventional Commits, stack, tests with every change); removed the design-approval phrase gate, review checkpoints, phase-branch rules and the contributor-credit line.
- `.env.example` files untouched.

## Tests

- Web: Vitest **162 passed** (one test removed with `peakWindow`); ESLint, `tsc --noEmit` and Prettier clean; `npm run test:design-prototype`: "prototype checks passed: 66 screen/width combinations and 2 dark-theme checks".
- Backend (unchanged): pytest **154 passed, 1 warning**, coverage 86%; Ruff "All checks passed!"; mypy "Success: no issues found in 89 source files".
- Browser: fresh `scripts/demo-down.sh` and `scripts/demo-up.sh -- npx playwright test`: **112 passed** at four widths, including the token canary.

## Skipped

- No fixtures or data were deleted; every fixture is used by a test.
- The backend and generator were not changed.
