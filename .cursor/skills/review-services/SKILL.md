---
name: review-services
description: >-
  Reviews local agent services (printing-agent MQTT, accounting-agent polling)
  for reliability, idempotency, error handling, and safe interaction with
  print_jobs and accounting data. Use when services/ changes, or when
  skills-advisor recommends this lens.
---

# Review: services (agents)

## Context

- **`services/printing-agent/`** — MQTT daemon; detects print completion; writes raw `print_jobs`.
- **`services/accounting-agent/`** — polls unprocessed `print_jobs`; updates spools and `journal_entries`.

## Look for

- **Idempotency** — duplicate MQTT messages or poll cycles causing double writes or inconsistent state.
- **Failure modes** — partial writes, missing retries where safe, unbounded error loops, silent drops.
- **Concurrency** — races when multiple workers or restarts process the same job.
- **Observability** — logging enough to debug without logging secrets; meaningful error context.
- **Boundaries** — correct Mongo collections and field names vs shared types in `mongo-db/`.

## Output format

1. **Reliability summary** — main risks introduced or mitigated by the change.
2. **Findings** — file or component → issue → recommendation (severity tagged).
3. **Suggested manual tests** — short list if automation is thin.

If the diff only touches shared libraries used by services, focus on agent-relevant impact.
