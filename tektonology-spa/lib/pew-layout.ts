import type { HardwareStatus, Kneeler, PewRow, PewSection } from "@/data/types";

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

/**
 * Per-kneeler status for a single part name, matching the pew map color logic.
 * Use when the map (or export) is filtered to one part.
 */
export function kneelerStatusForPart(
  kneeler: Kneeler,
  partName: string,
): HardwareStatus | "none" {
  if (kneeler.hardware.length === 0) return "none";
  const items = kneeler.hardware.filter((h) => h.name === partName);
  if (items.length === 0) return "none";
  const statuses = items.map((h) => h.status);
  if (statuses.every((s) => s === "installed")) return "installed";
  if (statuses.some((s) => s === "installed" || s === "upcoming")) return "upcoming";
  if (statuses.some((s) => s === "needed")) return "needed";
  return "unknown";
}

/** Sum of kneeler capacities in a row (used to scale row width in the pew map). */
export function rowCapacitySum(row: PewRow): number {
  return row.kneelers.reduce((s, k) => s + k.capacity, 0);
}

/**
 * Capacity used for map row-width scaling. When both kneelers and pew rail widths exist,
 * uses the larger sum so the strip matches the physical front (e.g. 3+3+3 rail vs 9 kneeler units).
 */
export function effectiveRowCapacityForMap(row: PewRow, section: PewSection): number {
  const kneelerSum = rowCapacitySum(row);
  const railSum = row.pewRailSegmentWidths?.reduce((s, w) => s + w, 0) ?? 0;

  if (kneelerSum > 0 && railSum > 0) {
    return Math.max(kneelerSum, railSum);
  }
  if (kneelerSum > 0) return kneelerSum;

  const c = row.pillarBenchContinuation;
  if (c) {
    const prev = section.rows.find((r) => r.id === c.fromRowId);
    if (prev) {
      const prevSum = rowCapacitySum(prev);
      if (railSum > 0) return Math.max(prevSum, railSum);
      return prevSum;
    }
  }
  if (railSum > 0) return railSum;
  return 0;
}

/** Widest row in the section (effective capacity for map scaling). */
export function maxRowCapacityInSection(section: PewSection): number {
  if (section.rows.length === 0) return 0;
  return Math.max(...section.rows.map((r) => effectiveRowCapacityForMap(r, section)));
}

/** Row strip width % when mapRowAlign is set (capped at 100%). */
export function alignRowStripWidthPercent(section: PewSection, rowSum: number): number {
  const mapAlign = section.mapRowAlign ?? "fill";
  if (mapAlign === "fill") return 100;
  const maxCap = maxRowCapacityInSection(section);
  const refCap = section.mapRowAlignRefCapacity ?? maxCap;
  if (refCap <= 0) return 100;
  return Math.min(100, (rowSum / refCap) * 100);
}

/**
 * When a pew section row is narrower than the section grid, extra “empty” unit columns in the
 * Excel layout go on the left (toward the aisle / nave center) or right, matching the map:
 * `mapRowAlign` "start" / west → padding on the right; "end" / east → on the left.
 * If `mapRowAlign` is missing, east and eastOuter default to the same as "end", west to "start";
 * "fill" keeps padding on the right (map rows are full width).
 */
export function emptyKneelerGridPadOnLeft(section: PewSection): boolean {
  if (section.mapRowAlign === "end") return true;
  if (section.mapRowAlign === "start") return false;
  if (section.mapRowAlign === "fill") return false;
  return section.side === "east" || section.side === "eastOuter";
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

/** Pew/rail strip segments: explicit widths first, else continuation, else pillar kneeler runs. */
export function pewRailSegmentsForRow(section: PewSection, row: PewRow): PewBenchSegment[] | null {
  if (row.pewRailSegmentWidths?.length) {
    const widths = row.pewRailSegmentWidths;
    const kinds = row.pewRailSegmentKinds;
    return widths.map((capacity, i) => ({
      id: `${row.id}-pew-rail-${i}`,
      capacity,
      variant: kinds?.[i] === "gap" ? "gap" : "pew",
    }));
  }
  if (row.pillarBenchContinuation) {
    return pewBenchSegmentsFromContinuation(section, row);
  }
  if (row.kneelers.length > 0 && row.kneelers.some(isPillarKneeler)) {
    return pewBenchSegmentsFromKneelers(row.kneelers, row.id);
  }
  return null;
}
