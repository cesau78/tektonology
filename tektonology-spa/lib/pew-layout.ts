import type { Kneeler, PewRow, PewSection } from "@/data/types";

/**
 * Warm wood browns (hex), not neutral gray — distinct from amber “Parts needed”.
 * Light: tan bench; medium: pillar / structural column.
 */
export const pewRailColorClass =
  "bg-[#d4b896] border border-[#b8956a] dark:bg-[#6d4c38] dark:border-[#5a3d2e]";

export const pewRailBarClass = `h-[5px] rounded-sm ${pewRailColorClass}`;

export function isPillarKneeler(k: Kneeler): boolean {
  return k.label === "Pillar";
}

export type PewBenchSegment = { id: string; capacity: number; variant: "pew" | "gap" };

/**
 * When a row has a structural pillar, the **bench** is continuous pew runs (e.g. 3+3+3+3)
 * while **kneelers** stay aligned to seating with a gap at the pillar (e.g. 3 | gap | 1 | 3 | 3).
 */
const PEW_BENCH_RUNS_WITH_PILLAR = 4;
const PEW_BENCH_RUN_CAPACITY = 3;

/** Bench strip for rows without a pillar: one segment per kneeler column. */
export function pewBenchSegmentsFromKneelers(kneelers: Kneeler[], rowId = "row"): PewBenchSegment[] {
  if (kneelers.some(isPillarKneeler)) {
    return Array.from({ length: PEW_BENCH_RUNS_WITH_PILLAR }, (_, i) => ({
      id: `${rowId}-pew-run-${i}`,
      capacity: PEW_BENCH_RUN_CAPACITY,
      variant: "pew" as const,
    }));
  }
  return kneelers.map((k) => ({
    id: `${k.id}-bench`,
    capacity: k.capacity,
    variant: "pew" as const,
  }));
}

/** Row 10+ bench strip aligned to pillar column from the row above. */
export function pewBenchSegmentsFromContinuation(
  section: PewSection,
  row: PewRow,
): PewBenchSegment[] | null {
  const c = row.pillarBenchContinuation;
  if (!c) return null;
  const prev = section.rows.find((r) => r.id === c.fromRowId);
  if (!prev) return null;
  return prev.kneelers.map((k) => ({
    id: `${row.id}-${k.id}-bench`,
    capacity: k.capacity,
    variant: k.id === c.alignKneelerId ? "gap" : "pew",
  }));
}
