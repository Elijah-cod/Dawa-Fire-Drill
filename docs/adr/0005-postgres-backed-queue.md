# 0005: A Postgres-backed run queue

**Status:** accepted

## Context

Scenario runs take longer than a request should, so they run asynchronously. A separate broker (Redis, RabbitMQ, a cloud queue) would add a service to deploy, secure and keep consistent with the database that already holds runs and snapshots.

## Decision

Runs are rows in Postgres. Submission is idempotent (an `Idempotency-Key` with the same payload returns the original run; a different payload returns 409). Workers (`dawa_api.jobs`) claim the next queued run, or one whose lease has expired, by setting a fresh lease token and a five-minute `lease_until` and incrementing `attempts`; completion is accepted only with the matching lease token, so a worker that lost its lease cannot overwrite a newer result. A failed run exposes a generic error, not provider or database details.

## Consequences

- One fewer service; queue state is transactional with the data it describes.
- Throughput is bounded by Postgres polling, which is ample for planning workloads but not for high-volume jobs.
- The web app polls for completion; the first verdict on the Kisumu page waits for that run (see the README's limitations).
