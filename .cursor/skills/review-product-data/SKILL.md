---
name: review-product-data
description: >-
  Reviews JSON product and batch data under tektonology-spa/data/ for camelCase
  keys, consistency with TypeScript consumers, and build-time loading
  assumptions. Use when data JSON or loaders change, or when skills-advisor
  recommends this lens.
---

# Review: product data

## Conventions (from `CLAUDE.md`)

- JSON keys must be **camelCase** (e.g. `printSettings`, `upperBoot`). Labels are derived at render — **not** stored as key names for display.
- Data lives in `tektonology-spa/data/` (products, batches); loaded at **build time** via `readFileSync` in the static site.

## Look for

- **Keys** — snake_case, spaces, or display strings used as keys.
- **Schema drift** — fields present in JSON but unused or missing where TypeScript/types expect them; renames that break consumers.
- **Shape** — inconsistent objects across files when they should share a shape; duplicate product metadata that should reference one source of truth.
- **Build assumptions** — code that implies runtime server fetch for this data (conflicts with static export) unless the user intentionally added an external API.

## Output format

1. **Summary** — data consistency and key hygiene for the reviewed files.
2. **Issues** — file path → problem → fix direction (camelCase rename, shared type, etc.).
3. **Follow-ups** — optional migrations or UI label mapping if keys change.

If the change is unrelated to `data/` or product loaders, say so and skip deep JSON review.
