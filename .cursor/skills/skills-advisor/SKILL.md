---
name: skills-advisor
description: >-
  Routes pre-push review work by analyzing a commit’s scope (paths, diff shape,
  risk) and recommending which specialized review skills or lenses to run next.
  Use when preparing to push, choosing review passes for a commit, or when the
  user asks which reviews, skills, or agents to apply before a push.
---

# Skills advisor (pre-push routing)

## Purpose

Given what changed in a commit (or staged work), produce a **short, ordered plan** of which **review lenses** deserve attention. Lenses map to Cursor skills under `.cursor/skills/<name>/` when those skills exist; if one is missing, the recommendation still names the focus so the user can run that review manually or add a skill later.

This skill does **not** perform those reviews—it only **advises** which to run and why.

## Inputs to gather

Use whatever the user provides; if unclear, infer from git:

1. **Changed paths** — `git diff --name-only` (and `--cached` if relevant).
2. **Diff shape** — renames, new files vs edits, large churn vs small.
3. **Intent** — commit message, PR title, or user stated goal.

## Lens catalog (Tektonology)

| Skill folder (if present) | Focus |
|---------------------------|--------|
| `review-heuristic-imperatives` | Fit of the change with Reduce Suffering, Increase Prosperity, Increase Understanding (`heuristic-imperatives.md`). |
| `review-architecture` | Duplication, boundaries, shared abstractions, refactor opportunities that reduce surface area. |
| `review-security` | Auth0/API boundaries, secrets, injection, trust of client data, Mongo access patterns. |
| `review-tests` | Test gaps, brittle tests, missing cases for changed behavior. |
| `review-product-data` | JSON in `tektonology-spa/data/`, camelCase keys, schema consistency with consumers. |
| `review-api-contracts` | `tektonology-api/` routes, shared `mongo-db/` types, breaking changes for consumers. |
| `review-static-export` | Next.js static export constraints (`output: "export"`), no server runtime assumptions. |
| `review-services` | `services/printing-agent`, `services/accounting-agent` — daemons, MQTT, polling, idempotency. |

Add or rename rows as the repo gains skills; keep the table **one level** in this file or link a `reference.md` if it grows.

## Heuristics (path → lens)

Apply **multiple** lenses when paths overlap. Prefer **fewer, higher-signal** recommendations when the change is tiny (e.g. typo: suggest only what clearly applies).

- **`tektonology-spa/`** — `review-architecture`, `review-static-export`, `review-tests` (if TS/TSX touched); `review-product-data` if under `data/` or product loaders.
- **`tektonology-api/`** or **`mongo-db/`** — `review-api-contracts`, `review-security`, `review-architecture` if large structural edits.
- **`services/`** — `review-services`, `review-security`, `review-architecture` if shared helpers duplicated across agents.
- **Root config / CI / package manifests** — security-relevant or build-affecting: `review-security` and/or `review-static-export` as appropriate.
- **`3d-models/`** — usually outside web architecture skills; recommend `review-architecture` only if OpenSCAD modules show obvious duplication the user cares about, else **omit** or note “no default web lens.”
- **Values / tradeoffs** — large refactors, new features, API redesigns, or edits to `heuristic-imperatives.md`: suggest `review-heuristic-imperatives` as **primary** or **optional** (user may skip for trivial commits).

## Output format

Respond with:

1. **One-line summary** of the change scope (areas + risk guess: low/medium/high).
2. **Recommended lenses** — ordered list. Each item:
   - **Lens** (skill folder name or focus name)
   - **Priority** — primary / secondary / optional
   - **Why** — 1–2 sentences tied to paths or diff
   - **Skip if** — when it’s safe to skip this lens for this commit
3. **Suggested user prompt** — one copy-paste line the user can run next, e.g. “Run `review-architecture` on this diff” or “Deep review `tektonology-spa/app/...` for static-export violations.”

Keep the plan **under seven** lens entries unless the user explicitly wants exhaustive coverage.

## Constraints

- Align recommendations with `heuristic-imperatives.md` and `CLAUDE.md` (camelCase JSON, static export, layout).
- Do not invent file paths; ground **Why** in actual changed paths or stated intent.
- If no specialized skill exists yet for a lens, still list the lens and say the user may add `.cursor/skills/<name>/SKILL.md` or ask for a manual pass with that focus.
