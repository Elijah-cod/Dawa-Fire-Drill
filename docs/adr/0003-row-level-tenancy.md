# 0003: Row-level tenancy in Postgres

**Status:** accepted

## Context

The product is meant for several countries and, within Kenya, county-scoped planners. Filtering tenants only in application code is easy to get wrong in one query.

## Decision

Tenant scope comes only from the signed token's server-controlled `app_metadata` (role, country code, county code, facility), never from a header or request body. Postgres row-level security enforces country scope on scenario data: migration `0002_scenario_rls` enables and forces RLS with a policy comparing `country_code` to the transaction-local setting `app.country_code`, which the API sets per request. County-scoped endpoints additionally check county scope and role (for example, a facility role can read only its own facility).

## Consequences

- A missing filter in one query cannot leak another country's rows when the app runs as a non-superuser role without `BYPASSRLS`; superusers bypass RLS, so deployments must use a restricted role (the local Compose stack uses disposable superuser credentials and says so).
- Some legacy country-only paths are not yet county-aware; county-scoped identities are denied access to them until they are migrated.
