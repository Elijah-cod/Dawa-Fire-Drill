# Stage 4 report: public read-only demo

## Done

- **Static demo mode (`STATIC_DEMO=1`):**
  - `apps/web/next.config.ts` (new): refuses to build or start when any server-side variable is set; leaves the proxy out of the build; exposes `NEXT_PUBLIC_STATIC_DEMO` to the browser; allows a separate `NEXT_DIST_DIR` so the check does not overwrite the local demo build.
  - `src/app/api/[...path]/route.ts` renamed to `route.proxy.ts` (`git mv`) and its test import updated. The normal build still has the route (`.next/app-path-routes-manifest.json` lists `/api/[...path]`; `GET /api/demo/capabilities` → 200 on the demo session).
  - `src/app/page.tsx` and `src/app/kisumu/page.tsx` use fixture mode when `STATIC_DEMO=1`. The fixture mode has no role switcher, because the fixture sign-in never grants role switching.
  - `src/api/mock-client.ts` allows fixtures in production only when `NEXT_PUBLIC_STATIC_DEMO` is `1`.
  - `src/components/app-shell.tsx` shows "Static synthetic demo: it runs in your browser from bundled fixtures, with no backend or sign-in." at the start of the banner (Swahili string added).
- **Verification:** `apps/web/scripts/verify-static-demo.mjs`, run with `npm run test:static-demo` (plus `npm run build:static-demo`). `.next-static/` is ignored by git, ESLint and Prettier, and the script restores `tsconfig.json`, which Next.js edits when building into a second directory.
- **Unit test:** `mock-client.test.ts` adds "allows fixtures in production only for the static public demo".
- **Docs:** `docs/deploy-demo.md` (Vercel free tier; not deployed). The README quickstart now says `docker compose down` deletes the local database.

## Output of `npm run test:static-demo`

```
ok   build refuses to run when DEMO_API_TOKEN is set
ok   static demo build succeeds
ok   no server/app/api in the build
ok   no /api route in app-path-routes-manifest.json
ok   no token-shaped value in the build (none)
ok   start refuses to run when E2E_DEMO_TOKEN is set
ok   static demo serves /kisumu
ok   GET /api/demo/session returns 404 (got 404)
ok   banner says it is a static synthetic demo
ok   no role switcher on the overview
ok   Kisumu verdict and ranking render from fixtures (209 stockouts, 30 of 30 units)
ok   no role switcher on Kisumu
ok   bin-card capture view renders from fixtures
ok   no request to /api or the backend (0)
static demo checks passed
```

## Tests

- Vitest **163 passed**; ESLint, `tsc --noEmit` and Prettier clean.
- Browser suite on the normal demo (`scripts/demo-up.sh -- npx playwright test`): **112 passed**, after re-seeding (see incident).

## Incident

The first browser run in this stage gave 84 failed, 28 passed: `GET /api/counties/042/pilot` returned 404. Cause: in Stage 3 I ran `docker compose -f infra/compose.yaml down` on the existing stack to free the ports for the clean-clone check. The Compose file declares no volumes, so this deleted the local Postgres data. The data is synthetic and reproducible, so I re-ran the README's two seeding commands (`persist --country KE --seed 42` → created; `seed_counties --seed 42` → 47 planning, 1 pilot). After that the suite passed 112/112. Earlier local run history in that database is gone.

## Skipped

- No deployment (as instructed).
