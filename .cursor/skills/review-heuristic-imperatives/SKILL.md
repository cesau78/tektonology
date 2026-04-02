---
name: review-heuristic-imperatives
description: >-
  Reviews a change or proposal against heuristic-imperatives.md (Reduce Suffering,
  Increase Prosperity, Increase Understanding). Use for significant refactors, design
  decisions, contentious tradeoffs, before push when the user wants a values pass,
  or when skills-advisor recommends this lens.
---

# Review: heuristic imperatives

## Source of truth

Read **`heuristic-imperatives.md`** at the repository root. The three criteria have **no fixed priority** — weigh all that apply.

## Scope

User points at a diff, plan, or question. This review is **not** a substitute for security, tests, or architecture DRY passes — it answers: *does this choice align with the imperatives, and where does it trade off?*

## Output format

1. **Summary** — one paragraph: overall fit with the three heuristics.
2. **Per imperative** — for each of Reduce Suffering, Increase Prosperity, Increase Understanding: **supported / mixed / weak** with one concrete reason tied to the change.
3. **Tradeoffs** — if improving one heuristic strains another, name it explicitly.
4. **Suggestions** — optional small shifts that better satisfy the imperatives without a full rewrite.

Keep it proportional: a tiny fix may need only a short summary.
