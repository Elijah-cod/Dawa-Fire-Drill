# Decisions log

Choices made while preparing the repository for portfolio use, with a one-line reason each.

| # | Decision | Reason |
| --- | --- | --- |
| 1 | Created a local `main` branch at the tip of `phase/3b-ux` (`790f8f6`) and worked there. | No `main` branch existed locally or on the remote, and `phase/3b-ux` contains every earlier phase branch. |
| 2 | Tagged `pre-portfolio-prep` on `790f8f6` before any change. | Required rollback point. |
| 3 | Added an MIT `LICENSE`, copyright "Elijah Mathai" (the only author in `git log`). | No licence file or licence field existed; the brief names MIT as the default. |
| 4 | Did not add a `license` field to `apps/api/pyproject.toml`. | The backend is out of scope; the root `LICENSE` covers the whole repository. |
| 5 | Kept `AGENTS.md`, rewritten as neutral engineering guidelines. | Most of it is sound engineering guidance; only workflow gates, review checkpoints and the contributor-credit rule were dropped. |
| 6 | Moved working notes to `docs/process/` (progress log, phase notes, critiques, approval and review records, Figma checklist, product brief, shared-types placeholder) rather than deleting them. | They record how the project was built and are not dead code; moving keeps them available. |
| 7 | Kept the design specs and both prototypes in `docs/design/`. | They are design documentation, and `npm run test:design-prototype` in CI checks the first prototype. |
| 8 | Removed `peakWindow` and 50 translation keys (both locales). | `git grep` showed no use outside their own tests; the redesign replaced that UI. |
| 9 | Left the Swahili review table in `docs/process/phases/3.md` as written, including the 50 removed keys. | It is a historical working note; the live strings are in `apps/web/src/preferences/preferences.tsx`. |
| 10 | Kept `scripts/demo.sh` and `apps/web/src/fixtures/kisumu-v2-facilities.json`. | The script is a documented API walkthrough and the fixture is used by `facility-map.test.tsx`. |
