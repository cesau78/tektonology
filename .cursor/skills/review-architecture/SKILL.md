---
name: review-architecture
description: >-
  Reviews code structure for duplication, unclear boundaries, and refactor
  opportunities that consolidate logic and reduce surface area. Use when
  reviewing a diff or module before push, when the user asks for a DRY or
  architecture pass, or when skills-advisor recommends this lens.
---

# Review: application architecture

## Scope

Applies to code the user points at (diff, files, or directory). Prefer **actionable consolidation** over style nitpicks. Align suggestions with `CLAUDE.md` imperatives: reduce suffering, increase prosperity and understanding.

## Look for

- **Duplication** — parallel components/hooks/utilities that differ only by data or labels; copy-pasted validation or mapping logic.
- **Boundaries** — logic that belongs in a shared module vs page-specific; leaking UI concerns into data loaders or vice versa.
- **Naming and modules** — whether new abstractions clarify ownership or obscure it.
- **Escape hatches** — when duplication is intentional (generated assets, one-off prints), say so briefly.

## De-prioritize

Cosmetic renames, formatting-only churn, or large speculative rewrites unrelated to the changed code.

## Output format

1. **Summary** — 2–4 sentences on structural health of the reviewed scope.
2. **Findings** — grouped:
   - **Worth doing** — concrete DRY or boundary fixes with file/area pointers.
   - **Optional** — smaller cleanups.
   - **Not recommended** — refactors that add churn without clear benefit.
3. **Suggested order** — if multiple refactors, what to tackle first and why.

Keep the list proportional to scope; a tiny diff deserves a short answer.
