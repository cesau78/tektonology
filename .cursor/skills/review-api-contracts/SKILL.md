---
name: review-api-contracts
description: >-
  Reviews Express API routes, shared mongo-db TypeScript types, and compatibility
  between server and consumers. Use when tektonology-api/ or mongo-db/ changes,
  or when skills-advisor recommends this lens or the user asks for an API contract
  review before push.
---

# Review: API contracts

## Scope

- **`tektonology-api/`** — routes, handlers, status codes, request/response shapes.
- **`mongo-db/`** — document interfaces and shared types used by API and tools.

## Look for

- **Breaking changes** — removed/renamed fields, stricter validation that breaks existing clients, route path or method changes.
- **Consistency** — TypeScript types aligned with actual JSON bodies and Mongo documents; duplicate type definitions that could unify.
- **Errors** — consistent error shape and HTTP codes; leaks of raw DB errors to clients.
- **Versioning** — if the repo has no versioning strategy, flag breaking changes explicitly so callers can adapt.

## Output format

1. **Contract impact** — none / additive / breaking (with brief justification).
2. **Findings** — route or type → issue → recommendation.
3. **Consumer checklist** — SPA or services that may need updates (by path or name only; verify in repo if unsure).

If the diff only touches unrelated packages, state limited scope.
