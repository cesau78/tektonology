import type { HardwareItem, HardwareStatus, Kneeler, PewRow, PewSection } from "@/data/types";

/**
 * Warm wood browns (hex), not neutral gray — distinct from amber “Parts needed”.
 * Light: tan bench; medium: pillar / structural column.
 */
export const pewRailColorClass =
  "bg-[#d4b896] border border-[#b8956a] dark:bg-[#6d4c38] dark:border-[#5a3d2e]";

export const pewRailBarClass = `h-[5px] rounded-sm ${pewRailColorClass}`;

/** Map pew-only row (no kneeler band): same height as {@link KneelerPartStripMap} (`h-2`). */
export const pewMapBenchBandClass = `h-2 w-full min-w-0 shrink-0 rounded-sm ${pewRailColorClass}`;

export function isPillarKneeler(k: Kneeler): boolean {
  return k.type === "Pillar" || k.label === "Pillar";
}

export function isPewOnlyKneeler(k: Kneeler): boolean {
  return k.type === "PewOnly";
}

/** Map progress numerator: no open work (original OK after inspection, or replacement installed). */
export function hardwareStatusIsComplete(status: HardwareStatus): boolean {
  return status === "installed" || status === "inspected";
}

/** Safe hardware list (pillars often omit `hardware` in JSON). */
export function kneelerHardware(k: Kneeler): HardwareItem[] {
  return k.hardware ?? [];
}

/**
 * Per-kneeler status for a single part name, matching the pew map color logic.
 * Use when the map (or export) is filtered to one part.
 */
export function kneelerStatusForPart(
  kneeler: Kneeler,
  partName: string,
): HardwareStatus | "none" {
  if (isPillarKneeler(kneeler) || isPewOnlyKneeler(kneeler)) return "none";
  const hw = kneelerHardware(kneeler);
  if (hw.length === 0) return "none";
  const items = hw.filter((h) => h.name === partName);
  if (items.length === 0) return "none";
  const statuses = items.map((h) => h.status);
  if (statuses.every((s) => hardwareStatusIsComplete(s))) {
    if (statuses.every((s) => s === "inspected")) return "inspected";
    if (statuses.every((s) => s === "installed")) return "installed";
    return "installed";
  }
  if (statuses.some((s) => hardwareStatusIsComplete(s) || s === "upcoming")) return "upcoming";
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

/**
 * Width numerator for pew-map row strips: kneeler `fr` sum when the row has kneelers (matches
 * `RowStripColumnGrid` tracks), otherwise {@link effectiveRowCapacityForMap}. Using kneeler sum
 * avoids stretching when pew rail widths round slightly larger than kneeler capacities (e.g. 9 vs 8.98),
 * which misaligned pillars across rows.
 */
export function mapRowStripWidthNumerator(row: PewRow, section: PewSection): number {
  if (row.kneelers.length > 0) {
    return rowCapacitySum(row);
  }
  return effectiveRowCapacityForMap(row, section);
}

/** Largest {@link mapRowStripWidthNumerator} in the section (reference width for map alignment). */
export function maxMapRowStripWidthNumeratorInSection(section: PewSection): number {
  if (section.rows.length === 0) return 0;
  return Math.max(...section.rows.map((r) => mapRowStripWidthNumerator(r, section)));
}

/** Row strip width % for a row when mapRowAlign is set (capped at 100%). */
export function alignMapRowStripWidthPercent(section: PewSection, row: PewRow): number {
  const mapAlign = section.mapRowAlign ?? "fill";
  if (mapAlign === "fill") return 100;
  const maxCap = maxMapRowStripWidthNumeratorInSection(section);
  const refCap = section.mapRowAlignRefCapacity ?? maxCap;
  if (refCap <= 0) return 100;
  const num = mapRowStripWidthNumerator(row, section);
  return Math.min(100, (num / refCap) * 100);
}

/** Row strip width % when mapRowAlign is set (capped at 100%). Prefer {@link alignMapRowStripWidthPercent}. */
export function alignRowStripWidthPercent(section: PewSection, rowSum: number): number {
  const mapAlign = section.mapRowAlign ?? "fill";
  if (mapAlign === "fill") return 100;
  const maxCap = maxMapRowStripWidthNumeratorInSection(section);
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

/**
 * True when pew/rail segments share the same column widths as kneelers and each gap lines up
 * with a pillar kneeler (so the map can use one grid cell spanning rail + kneeler rows).
 */
export function railKneelerColumnsAligned(
  segments: PewBenchSegment[],
  kneelers: Kneeler[],
): boolean {
  if (segments.length !== kneelers.length) return false;
  for (let i = 0; i < kneelers.length; i++) {
    if (segments[i].capacity !== kneelers[i].capacity) return false;
    const gap = segments[i].variant === "gap";
    const pillar = isPillarKneeler(kneelers[i]);
    if (gap !== pillar) return false;
  }
  return true;
}

const CAP_EPS = 1e-6;

/**
 * Split pew/rail segments across kneeler column widths (left-to-right). Returns null if
 * capacities do not consume the rail exactly.
 */
export function pewRailChunksPerKneelerColumn(
  segments: PewBenchSegment[],
  kneelers: Kneeler[],
): PewBenchSegment[][] | null {
  if (segments.length === 0 || kneelers.length === 0) return null;
  const columns: PewBenchSegment[][] = kneelers.map(() => []);
  let si = 0;
  let srem = segments[0]!.capacity;

  function pushChunk(col: number, variant: PewBenchSegment["variant"], cap: number) {
    if (cap <= CAP_EPS) return;
    const arr = columns[col]!;
    const prev = arr[arr.length - 1];
    if (prev && prev.variant === variant) {
      prev.capacity += cap;
    } else {
      arr.push({ id: `rail-${col}-${arr.length}`, capacity: cap, variant });
    }
  }

  for (let ki = 0; ki < kneelers.length; ki++) {
    let need = kneelers[ki]!.capacity;
    while (need > CAP_EPS) {
      if (si >= segments.length) return null;
      const seg = segments[si]!;
      const take = Math.min(need, srem);
      pushChunk(ki, seg.variant, take);
      need -= take;
      srem -= take;
      if (srem <= CAP_EPS) {
        si++;
        srem = si < segments.length ? segments[si]!.capacity : 0;
      }
    }
  }
  if (si !== segments.length) return null;
  return columns;
}

/** Map split rail chunks for one kneeler column to a single strip variant (map row). */
export function mapColumnRailVariant(chunks: PewBenchSegment[]): "pew" | "gap" {
  if (chunks.length === 0) return "pew";
  if (chunks.every((c) => c.variant === "gap")) return "gap";
  return "pew";
}

/** One rail segment per kneeler column: pew run or gap, for map row alignment. */
export function pewMapSyntheticRailSegmentsFromKneelers(
  kneelers: Kneeler[],
  rowId: string,
): PewBenchSegment[] {
  return kneelers.map((k, i) => ({
    id: `${rowId}-map-syn-${i}`,
    capacity: k.capacity,
    variant: isPillarKneeler(k) ? ("gap" as const) : ("pew" as const),
  }));
}

/**
 * Pew/rail segments for the map strip: always one entry per kneeler column so rail and
 * kneeler rows share the same horizontal axis. Uses explicit rail + partition when possible,
 * otherwise falls back to synthetic pew/gap from kneeler columns.
 */
export function mapPewRailSegmentsAlignedToKneelerColumns(
  section: PewSection,
  row: PewRow,
): PewBenchSegment[] {
  const kneelers = row.kneelers;
  if (kneelers.length === 0) {
    return pewRailSegmentsForRow(section, row) ?? [];
  }

  if (row.pewRailSegmentWidths?.length) {
    const explicit: PewBenchSegment[] = row.pewRailSegmentWidths.map((capacity, i) => ({
      id: `${row.id}-map-explicit-${i}`,
      capacity,
      variant: row.pewRailSegmentKinds?.[i] === "gap" ? "gap" : "pew",
    }));
    const chunks = pewRailChunksPerKneelerColumn(explicit, kneelers);
    if (chunks) {
      return kneelers.map((k, i) => ({
        id: `${row.id}-mapcol-${k.id}`,
        capacity: k.capacity,
        variant: mapColumnRailVariant(chunks[i]!),
      }));
    }
  }

  const base = pewRailSegmentsForRow(section, row);
  if (base && railKneelerColumnsAligned(base, kneelers)) {
    return base;
  }
  if (base) {
    const chunks = pewRailChunksPerKneelerColumn(base, kneelers);
    if (chunks) {
      return kneelers.map((k, i) => ({
        id: `${row.id}-mapcol-${k.id}`,
        capacity: k.capacity,
        variant: mapColumnRailVariant(chunks[i]!),
      }));
    }
  }

  return pewMapSyntheticRailSegmentsFromKneelers(kneelers, row.id);
}
