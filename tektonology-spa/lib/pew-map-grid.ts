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

/**
 * Sorted unique row numbers across nave + rear + outer pews; includes the transept row when the
 * layout has a cross aisle (`transeptGridRow`, default 9).
 */
export function collectGridRowNumbers(sections: PewSection[], transeptGridRow: number = 9): number[] {
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
    set.add(transeptGridRow);
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * Pew sections in church-map column order for one grid row (matches {@link ChurchAlignedPewTable}):
 * west outer, west blocks by group, east blocks by group, east outer. Omits cross-aisle / full-width.
 */
export function churchGridRowMajorSectionOrder(sections: PewSection[]): PewSection[] {
  const pewSections = sections.filter((s) => s.type !== "crossAisle" && s.side !== "full");
  const westOuter = pewSections.filter((s) => s.side === "westOuter");
  const eastOuter = pewSections.filter((s) => s.side === "eastOuter");
  const west = pewSections
    .filter((s) => s.side === "west" && (s.type ?? "pews") === "pews")
    .sort((a, b) => a.group - b.group);
  const east = pewSections
    .filter((s) => s.side === "east" && (s.type ?? "pews") === "pews")
    .sort((a, b) => a.group - b.group);
  return [...westOuter, ...west, ...east, ...eastOuter];
}
