---
name: review-security
description: >-
  Reviews changes for auth boundaries, secret handling, injection risks, and
  unsafe trust of client or external input. Use for tektonology-api, services,
  mongo access, or when skills-advisor recommends this lens or the user asks for
  a security pass before push.
---

# Review: security

## Scope

Ground findings in **actual paths or APIs** in the diff; avoid generic OWASP lectures. This repo uses **Express + Auth0 + MongoDB** (`tektonology-api/`), local **services** agents, and a **static** Next export (no server runtime in the SPA).

## Look for

- **Auth** — protected routes, token validation, missing checks on mutating operations, scope leaks between users/tenants if applicable.
- **Secrets** — API keys, connection strings, or tokens committed or logged; use of env vars vs hardcoding.
- **Injection** — unsanitized input in queries, shell commands, or dynamic Mongo filters.
- **Trust** — treating client-submitted data as authoritative without server validation where the API exists.
- **Mongo** — overly broad updates, missing filters on multi-document operations, error messages leaking internals.

## Output format

1. **Risk level** — low / medium / high for the reviewed change, one sentence why.
2. **Findings** — each with: **issue**, **location** (file or route), **recommendation**, **severity** (critical / important / minor).
3. **Residual risk** — what was not reviewed (e.g. deployment config) if relevant.

If the change is docs-only or purely presentational SPA with no API, state that and keep the review brief.
