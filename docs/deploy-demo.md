# Deploying the static public demo

The public demo is the Next.js frontend built with `STATIC_DEMO=1`. In that mode it:

- serves bundled synthetic fixtures (`apps/web/src/fixtures/`) through the in-browser mock client, so it makes no request to the backend or to `/api`;
- leaves the API proxy out of the build (the proxy file is `route.proxy.ts`, which is a route only in the normal build);
- has no token and no role switcher, and shows a banner saying it is a static synthetic demo;
- refuses to build or start if any server-side setting is present: `DEMO_API_TOKEN`, `E2E_DEMO_TOKEN`, `API_INTERNAL_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_URL`, `OPENAI_API_KEY` or `GEMINI_API_KEY`.

What works: the national overview, the Kisumu page at the four prepared shocks (0, 20, 40, 100%), the budget slider in 5-unit steps at 20% and 40% (recorded OR-Tools rankings), the timeline, stockout order, funding trace, facilities table and map, bin-card capture with manual entry, the guided demo, Swahili and dark theme. What does not: new scenarios, other budgets or shocks, saving anything (capture "saves" only in the fixture client).

## Check it locally first

From `apps/web`:

```sh
npm ci
npx playwright install chromium
npm run test:static-demo
```

The check builds into `.next-static`, confirms the build and `next start` refuse to run with a token set, confirms there is no `/api` route and no token-shaped value in the output, then serves the demo and loads the overview, Kisumu and capture views in a browser while asserting that no request reaches `/api` or the backend. To try it by hand: `npm run build:static-demo && STATIC_DEMO=1 npx next start -p 3400`.

## Vercel (free tier)

These steps were written for, not run against, a Vercel account; nothing has been deployed.

1. Push the repository to GitHub (a private repository works).
2. In Vercel, **Add New… → Project**, import the repository.
3. **Root Directory:** `apps/web`. **Framework preset:** Next.js. Leave the build command as `npm run build` (it runs `next build --webpack`) and the install command as `npm ci`.
4. **Environment variables:** add `STATIC_DEMO` = `1` for Production and Preview. It is needed at build time and at run time, because the pages read it on the server. Add no other server-side variables; the build fails on purpose if one of the variables listed above is set.
5. Optional: `NEXT_PUBLIC_OSM_TILE_URL` to use a tile provider other than `tile.openstreetmap.org`. The default OpenStreetMap tiles are subject to the OSM Foundation tile usage policy (https://operations.osmfoundation.org/policies/tiles/), which allows light use with attribution; for heavier traffic use a provider whose terms allow it.
6. Deploy, then open `/` and `/kisumu`: the banner should start with "Static synthetic demo", there should be no "Demo role" selector, and the browser's network panel should show no request to `/api`.

To take it down, delete the Vercel project. The local demo (`scripts/demo-up.sh`) is unaffected by any of this.
