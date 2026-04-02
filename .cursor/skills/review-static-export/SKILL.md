---
name: review-static-export
description: >-
  Reviews Next.js code in tektonology-spa for static export compatibility
  (output export), avoiding server-only APIs in the client bundle, and
  build-time data loading patterns. Use when SPA app or config changes, or when
  skills-advisor recommends this lens.
---

# Review: static export

## Constraints (from `CLAUDE.md`)

- **`output: "export"`** — no Node server at request time for the static site.
- Product/batch data from `tektonology-spa/data/` is read at **build** time (e.g. `readFileSync`), not fetched per user request from the deployed static host unless explicitly using an external API.

## Look for

- **Server-only APIs** in client components or shared code paths: `fs`, `path` for runtime IO, dynamic server features without `generateStaticParams` / SSG patterns where appropriate.
- **Implicit SSR** — assumptions that `headers()`, `cookies()`, or request-scoped data exist at runtime on static pages.
- **Env misuse** — secrets needed only at build vs accidentally exposed to client bundle (`NEXT_PUBLIC_*`).
- **Routing** — features incompatible with static export (verify against Next version docs if introducing new dynamic features).

## Output format

1. **Compatibility** — likely OK / needs attention / likely broken for static export.
2. **Findings** — file → issue → fix (build-time data, client fetch to external API, split server module, etc.).
3. **Verify** — suggest `next build` or export script if a change is borderline.

When the change is CSS-only or pure presentational with no routing/data changes, keep the review minimal.
