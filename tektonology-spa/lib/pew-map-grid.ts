import type { PewRow, PewSection } from "@/data/types";

/** Row index for pew-map grid alignment from `mapRowNumber` or label `Row N`. */
export function parseMapRowNumber(row: PewRow): number | null {
  if (row.mapRowNumber != null && Number.isFinite(row.mapRowNumber)) {
    return row.mapRowNumber;
  }
  const m = row.label.trim().match(/^Row (\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

function isPewSectionForGrid(s: PewSection): boolean {
  /** Cross-aisle sections are skipped before this runs. Full-width blocks are not nave/rear/outer pews. */
  return s.side !== "full";
}

/** Sorted unique row numbers across nave + rear + outer pews; includes transept row when layout has a cross aisle. */
export function collectGridRowNumbers(sections: PewSection[]): number[] {
  const set = new Set<number>();
  let hasTransept = false;
  for (const s of sections) {
    if (s.type === "crossAisle") {
      hasTransept = true;
      continue;
    }
    if (!isPewSectionForGrid(s)) continue;
    for (const r of s.rows) {
      const n = parseMapRowNumber(r);
      if (n != null) set.add(n);
    }
  }
  if (hasTransept) {
    set.add(9);
  }
  return [...set].sort((a, b) => a - b);
}
