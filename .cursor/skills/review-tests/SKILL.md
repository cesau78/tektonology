---
name: review-tests
description: >-
  Reviews tests for gaps, brittleness, and missing coverage for changed behavior.
  Use when test files or implementation under test changed, before push, or when
  skills-advisor recommends this lens or the user asks for a test review.
---

# Review: tests

## Scope

Focus on **tests touched or implied** by the user’s diff or stated behavior change. Prefer **behavioral** coverage over line-count.

## Look for

- **Gaps** — new branches, errors, or edge cases with no assertion.
- **Brittleness** — overspecified snapshots, timing flakes, reliance on implementation details that will churn.
- **Quality** — tests that read intent clearly; redundant tests that could merge.
- **Tooling** — wrong matchers, missing async handling, unhandled promise rejections in test code.

## Project context

- SPA tests may live near features (e.g. `*.test.tsx`); align with existing patterns in the same folder.

## Output format

1. **Coverage assessment** — adequate / partial / insufficient for the change, briefly why.
2. **Gaps** — bullet list: scenario → suggested test idea (not necessarily full code).
3. **Brittleness** — items to relax or rewrite, with file references.
4. **Optional** — nice-to-have tests if time allows.

If no tests changed and behavior did, note that adding tests may be appropriate.
