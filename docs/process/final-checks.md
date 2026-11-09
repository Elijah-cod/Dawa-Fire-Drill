# Final checks

Run on `main` at `1528715` (all stage commits before this document), 2026-11-09, macOS arm64, Node v24.21.0, uv 0.12.21, Docker Compose, gitleaks v8.30.1 (Docker).

## Web (`apps/web`)

```
$ npm test
 Test Files  29 passed (29)
      Tests  163 passed (163)
$ npm run lint

exit 0
$ npm run typecheck
exit 0
$ npm run format:check
All matched files use Prettier code style!
$ npm audit --audit-level=low
found 0 vulnerabilities
$ npm run test:design-prototype
prototype checks passed: 66 screen/width combinations and 2 dark-theme checks
$ npm run test:static-demo
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

## Backend (`apps/api`)

```
$ uv run --frozen pytest -q
TOTAL                                          3144    425    86%
154 passed, 1 warning in 27.27s
$ uv run --frozen ruff check .
All checks passed!
$ uv run --frozen ruff check ../../infra/load
All checks passed!
$ uv run --frozen mypy dawa_api
Success: no issues found in 89 source files
$ uv run --frozen bandit -r dawa_api -q
exit 0
$ uv run --frozen pip-audit
No known vulnerabilities found
Name     Skip Reason
-------- -----------------------------------------------------------------------
dawa-api Dependency not found on PyPI and could not be audited: dawa-api (0.1.0)
```

Bandit printed no findings with `-q` and exited 0.

## Browser suite (local stack, fresh demo session)

`bash scripts/demo-down.sh` then `bash scripts/demo-up.sh -- npx playwright test --reporter=line`:

```
  112 passed (1.5m)
```

The 112 include the 4 token-canary tests (one per width) run with `E2E_DEMO_TOKEN` set by `demo-up.sh`. The API logged 0 HTTP 429 responses during the run.

## gitleaks

Full history, all refs (`gitleaks git /repo --log-opts=--all --redact`):

```
7:27AM INF 217 commits scanned.
7:27AM INF scanned ~12071703 bytes (12.07 MB) in 4.58s
7:27AM INF no leaks found
```

Working tree (a copy of the 411 tracked and non-ignored files, `gitleaks dir --redact`):

```
7:27AM INF scanned ~2350208 bytes (2.35 MB) in 429ms
7:27AM INF no leaks found
```

## History checks

```
$ git log --all --format="%an <%ae>" | sort | uniq -c
 217 Elijah Mathai <iamngunjiri@gmail.com>
$ git log --all --format="%cn <%ce>" | sort | uniq -c
 217 Elijah Mathai <iamngunjiri@gmail.com>
$ git log --all --format=%B | grep -ciE "co-authored-by|signed-off-by|generated with|claude|anthropic|chatgpt|copilot|openai|codex|cursor|ai|https?://(claude|chat)"
0
$ git rev-list --all --count
217
```

One author and one committer on all 217 commits; no co-author or sign-off trailers, session links or tool mentions in any commit message. History was not rewritten.

## Clean-clone quickstart

Cloned `main` (`1528715`) into a temporary directory and ran the README quickstart verbatim with `COMPOSE_PROJECT_NAME=dawafinal` (fresh images and database; the existing local stack was stopped with `docker compose stop`, which keeps its data, and restarted afterwards):

```
+(eval):1> docker compose -f infra/compose.yaml up -d --build
+(eval):1> curl --fail --retry 20 --retry-delay 3 --retry-all-errors http://localhost:8000/ready
curl: (56) Recv failure: Connection reset by peer
Warning: Problem (retrying all errors). Will retry in 3 seconds. 20 retries 
{"status":"ready","database":"ready"}+(eval):1> echo
+(eval):1> docker compose -f infra/compose.yaml exec -T api python -m dawa_api.ingestion.persist --country KE --seed 42
{"synthetic": true, "country_code": "KE", "seed": 42, "generator_version": 6, "created": true}
+(eval):1> docker compose -f infra/compose.yaml exec -T api python -m dawa_api.ingestion.seed_counties --seed 42
{"synthetic": true, "planning_created": 47, "pilot_created": 1}
+(eval):1> cd apps/web
+(eval):1> npm ci
added 571 packages, and audited 578 packages in 13s
found 0 vulnerabilities
+(eval):1> bash scripts/demo-up.sh
Demo ready: http://localhost:3300/kisumu (token valid for 4 hours).
```

The readiness check hit the same connection reset seen in Stage 3 and, with `--retry-all-errors`, retried and succeeded.

Browser suite in the clean clone (`scripts/demo-up.sh -- npx playwright test`): **108 passed, 4 failed**, with 6 HTTP 429 responses logged by the clone's API:

```
  1) [laptop] › tests/e2e/navigation.spec.ts:95:3 › every primary link works from Overview ─────────
    Error: expect(locator).toHaveAttribute(expected) failed

  2) [laptop] › tests/e2e/kisumu.spec.ts:145:1 › the budget slider funds three transfers at 30, four at 100 and none at 5 
    Test timeout of 30000ms exceeded.

  3) [mobile] › tests/e2e/kisumu.spec.ts:410:1 › facility role sees only its trusted facility ──────
    Test timeout of 30000ms exceeded.

  4) [tablet] › tests/e2e/kisumu.spec.ts:243:1 › the timeline counts match the run at days 0, 41 and 90 
    Test timeout of 30000ms exceeded.
```

The four tests rerun on their own in the clone (`npx playwright test -g …`, all four widths): **16 passed**. On a fresh database the first runs take longer, so the suite polls more and the shared demo identity exceeds its 1,200-requests-per-minute limit; see open items. The clone's containers, volumes and images were removed afterwards, and the existing stack was restarted with its data intact (Kisumu pilot via the demo proxy: 200).
