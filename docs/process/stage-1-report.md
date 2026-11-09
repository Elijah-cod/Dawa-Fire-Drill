# Stage 1 report: audit

**Done:** created the local tag `pre-portfolio-prep` on `790f8f6` and a local `main` branch at the same commit (no `main` existed locally or on the remote; see the decisions log). Wrote `docs/process/portfolio-audit.md` from read-only checks: tracked-file inventory, `git grep` for references, unused translation keys, `vulture` on the backend, the 20 largest blobs in history, workflow-term search, dependency licences from installed package metadata, and gitleaks on the full history.

**Commands and key outputs:** gitleaks v8.30.1 over all refs: `212 commits scanned … no leaks found` (full output in the audit). `git count-objects -vH`: 54.02 MiB loose. Vulture: only Pydantic `cls` false positives.

**Skipped:** nothing. No files other than the audit and this report were changed.
