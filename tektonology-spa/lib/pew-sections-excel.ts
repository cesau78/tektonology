import ExcelJS from "exceljs";
import type { HardwareStatus, Kneeler, Project, PewRow, PewSection } from "@/data/types";
import {
  emptyKneelerGridPadOnLeft,
  isPillarKneeler,
  kneelerStatusForPart,
  type PewBenchSegment,
} from "@/lib/pew-layout";
import { collectGridRowNumbers, parseMapRowNumber } from "@/lib/pew-map-grid";
import {
  formatBenchPewId,
  formatKneelerAggregateStatusForExcel,
  formatKneelerPartStatusForExcel,
} from "@/lib/pew-bench-display";
import { labelForRowFrontType } from "@/lib/pew-front-type-labels";

/** Grid columns per 1.0 capacity; keeps spans small (e.g. 1→3, 2.66→8, 3→9) without hundredths. */
const CAPACITY_TO_UNITS = 3;
/** Total Excel “column width” for one full capacity-1.0 in those units (3 units × this/3 = 8). */
const WIDTH_UNITS_PER_PERSON = 8;
/** In-cell newlines. Use with `wrapText: true` on the cell, or Excel shows one continuous line in the grid. */
const XlLf = "\r\n";

/**
 * Must match `addWorksheet({ properties: { defaultRowHeight } })`. Used to dial back
 * explicit row heights: with `wrapText` and a fixed `height`, the row often looked
 * one default grid line taller than the text.
 */
const PEW_SHEET_DEFAULT_ROW_HEIGHT_PT = 18;
/** Fitted to ~2 lines in column A; don’t go lower or multiline pew text can clip. */
const PEW_DATA_ROW_MIN_HEIGHT_PT = 40;
/** Fitted to column A with hoisted status (3+ lines) plus pew lines. */
const PEW_DATA_ROW_HOISTED_MIN_HEIGHT_PT = 48;
const PEW_TITLE_ROW_MIN_HEIGHT_PT = 64;

/** Strips a trailing blank line (common when inputs or formatters end with a newline). */
function trimTrailingNewlinesInCell(s: string): string {
  return s.replace(/(?:\r\n|\n|\r)+$/g, "");
}

/** e.g. `Date: April 15, 2026` (en-US long month, numeric day, full year). */
function exportDateHeaderLine(at: Date): string {
  return `Date: ${at.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
}

function capacityToColumnUnits(capacity: number): number {
  if (!Number.isFinite(capacity) || capacity <= 0) {
    return 1;
  }
  return Math.max(1, Math.round(capacity * CAPACITY_TO_UNITS));
}

function useExplicitPewRailLayoutForExport(row: PewRow): boolean {
  return Boolean(row.pewRailSegmentWidths?.length);
}

/** Seating width sum on explicit rail (pew segments only, excludes structural `gap` spans). */
function totalPewSeatingWidthOnExplicitRail(row: PewRow): number {
  const widths = row.pewRailSegmentWidths!;
  const kinds = row.pewRailSegmentKinds;
  let t = 0;
  for (let i = 0; i < widths.length; i++) {
    if (kinds?.[i] === "gap") continue;
    t += widths[i]!;
  }
  return t;
}

/** Sum of non-pillar kneeler capacities (floats, e.g. 2.66). Thrown if rail does not match; avoids duplicate bench IDs and 1p tails from bad data. */
function assertKneelersMatchPewSeatingOnExplicitRail(row: PewRow) {
  const pewW = totalPewSeatingWidthOnExplicitRail(row);
  const kneelW = row.kneelers
    .filter((k) => !isPillarKneeler(k))
    .reduce((s, k) => s + k.capacity, 0);
  const d = Math.abs(pewW - kneelW);
  // Allow 2.66-style rounding vs integer rail; reject e.g. 3+3+3+3 = 12 vs rail 3+1+3+3 = 10
  if (d > 0.25) {
    throw new Error(
      `Pew layout export: row ${row.id} — rail seating width (${pewW}) ` +
        `does not match sum of non-pillar kneeler capacities (${kneelW}). ` +
        `Each kneeler is placed left-to-right on pew segments; fix kneeler capacities or rail widths so they line up.`,
    );
  }
}

function rowDataColumnUnits(row: PewRow, section: PewSection): number {
  if (useExplicitPewRailLayoutForExport(row) && row.pewRailSegmentWidths) {
    return row.pewRailSegmentWidths.reduce(
      (s, w) => s + capacityToColumnUnits(w),
      0,
    );
  }
  if (row.kneelers.length === 0) {
    return 0;
  }
  return row.kneelers.reduce((s, k) => s + capacityToColumnUnits(k.capacity), 0);
}

function maxDataColumnUnitsInSection(section: PewSection): number {
  if (section.rows.length === 0) {
    return 1;
  }
  return Math.max(1, ...section.rows.map((r) => rowDataColumnUnits(r, section)));
}

function explicitPewRailSegments(row: PewRow): PewBenchSegment[] {
  const widths = row.pewRailSegmentWidths!;
  const kinds = row.pewRailSegmentKinds;
  return widths.map((capacity, i) => ({
    id: `${row.id}-export-rail-${i}`,
    capacity,
    variant: kinds?.[i] === "gap" ? "gap" : "pew",
  }));
}

/** Explicit rail "gap" segment label (lowercase, like padding `empty`). */
const PILLAR_GAP_EXPORT_LABEL = "pillar";

type KneelerWalkState = { ki: number; rem: number };

function initKneelerWalkState(row: PewRow): KneelerWalkState {
  if (row.kneelers.length === 0) return { ki: 0, rem: 0 };
  return { ki: 0, rem: row.kneelers[0]!.capacity };
}

type PendingBenchMerge = { kneeler: Kneeler; col0: number; col1: number };

/** Pew cells on Church grid: unknown / no-part reads as white (not aisle gray). */
const pewMapUnknownOrNoneFill: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFFFF" },
};

/** Light-mode Tailwind tints for needed / upcoming / installed (Excel is typically light). */
const MAP_GRID_STATUS_FILL: Record<HardwareStatus | "none", ExcelJS.Fill> = {
  unknown: pewMapUnknownOrNoneFill,
  needed: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } },
  upcoming: { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } },
  installed: { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } },
  none: pewMapUnknownOrNoneFill,
};

function applyPendingBenchMerge(
  ws: ExcelJS.Worksheet,
  r: number,
  pending: PendingBenchMerge,
  section: PewSection,
  row: PewRow,
  partName: string,
  statusOnRow: boolean,
  benchPewIdShownKneelers: Set<string>,
  applyPewMapStatusFill = false,
) {
  const { kneeler, col0, col1 } = pending;
  if (col0 < col1) {
    ws.mergeCells(r, col0, r, col1);
  }
  const master = ws.getCell(r, col0);
  const displayId = formatBenchPewId(section, row, kneeler);
  const continuationOfSameKneeler =
    !isPillarKneeler(kneeler) && benchPewIdShownKneelers.has(kneeler.id);
  if (!isPillarKneeler(kneeler) && !continuationOfSameKneeler) {
    benchPewIdShownKneelers.add(kneeler.id);
  }
  master.value = cellTextForKneeler(
    kneeler,
    partName || undefined,
    displayId,
    statusOnRow,
    continuationOfSameKneeler,
  );
  master.alignment = { wrapText: true, vertical: "top", horizontal: "center" };
  if (isPillarKneeler(kneeler)) {
    master.fill = pillarFill;
    master.font = { size: 9, italic: true, color: { argb: "FF6B7280" } };
  } else if (applyPewMapStatusFill) {
    master.fill = MAP_GRID_STATUS_FILL[kneelerStatusForPart(kneeler, partName)];
  }
}

const thinSide = (style: "thin" | "medium" = "thin") =>
  style === "medium"
    ? { style: "medium" as const, color: { argb: "FF333333" } }
    : { style: "thin" as const, color: { argb: "FF888888" } };

/** Pillar / rail gap: same gray as empty padding and aisles. */
const pillarFill: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE5E7EB" },
};

const headerFill: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF3F4F6" },
};

/** Trailing width padding, empty nave cells, W/E markers, center aisle, transept band. */
const emptyPaddingFill: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE5E7EB" },
};

const emptyPaddingFont: Partial<ExcelJS.Font> = {
  size: 9,
  italic: true,
  color: { argb: "FF9CA3AF" },
};

/** US Letter 8.5" × 11" (OOXML / Excel `paperSize`). */
const PAPER_SIZE_US_LETTER = 1;

/**
 * Fit the sheet to one page wide on Letter, landscape, so the pew grid is scaled to
 * the printable width (tall blocks may span multiple pages). Removes fixed % scale
 * so “Fit to” applies.
 */
function applyPewLayoutPrintPageSetup(ws: ExcelJS.Worksheet) {
  const next: ExcelJS.PageSetup = { ...ws.pageSetup };
  delete (next as { scale?: number }).scale;
  next.paperSize = PAPER_SIZE_US_LETTER;
  next.orientation = "landscape";
  next.margins = { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };
  next.fitToPage = true;
  next.fitToWidth = 1;
  next.fitToHeight = 0;
  next.horizontalCentered = true;
  ws.pageSetup = next;
}

/**
 * Merged label across grid columns: grey field, light "empty" (column A unchanged).
 * Single column uses one cell; no merge for fromCol === toCol.
 */
function setEmptyPaddingRegion(
  ws: ExcelJS.Worksheet,
  r: number,
  fromCol: number,
  toCol: number,
) {
  if (fromCol > toCol) {
    return;
  }
  if (fromCol < toCol) {
    ws.mergeCells(r, fromCol, r, toCol);
  }
  const cell = ws.getCell(r, fromCol);
  cell.value = "empty";
  cell.fill = emptyPaddingFill;
  cell.font = { ...emptyPaddingFont };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: false };
}

function isCrossAisle(s: PewSection) {
  return s.type === "crossAisle";
}

/**
 * Per-kneeler status string as shown on the 2+ line of a pew cell (not used for pillars).
 * Must match `cellTextForKneeler` when status is not hoisted to the row.
 */
function excelStatusLineForPewKneeler(
  k: Kneeler,
  partName: string,
): string | null {
  if (isPillarKneeler(k)) return null;
  if (!partName) {
    return formatKneelerAggregateStatusForExcel(k);
  }
  return formatKneelerPartStatusForExcel(k, partName);
}

/** If every non-pillar kneeler shares the same status line, return it for column A; else null. */
function hoistedStatusForRow(row: PewRow, partName: string): string | null {
  let common: string | null = null;
  let count = 0;
  for (const k of row.kneelers) {
    if (isPillarKneeler(k)) continue;
    const line = excelStatusLineForPewKneeler(k, partName);
    if (line === null) continue;
    count += 1;
    if (common === null) {
      common = line;
    } else if (common !== line) {
      return null;
    }
  }
  return count > 0 ? common : null;
}

function cellTextForKneeler(
  k: Kneeler,
  partName: string | undefined,
  displayId: string,
  statusOnRow: boolean,
  /** Second+ horizontal merge for the same kneeler (e.g. across a pillar) — do not repeat the bench id. */
  continuationOfSameKneeler = false,
): string {
  if (isPillarKneeler(k)) {
    return "Pillar (structural gap)";
  }
  const name = k.label ? `${k.label}${XlLf}` : "";
  if (continuationOfSameKneeler) {
    if (statusOnRow) {
      return trimTrailingNewlinesInCell(
        (k.label ?? "").trim() || "\u00a0",
      );
    }
    const rest = !partName?.trim()
      ? formatKneelerAggregateStatusForExcel(k)
      : formatKneelerPartStatusForExcel(k, partName);
    return trimTrailingNewlinesInCell(
      name.trim() ? `${name}${rest}` : rest,
    );
  }
  const body = statusOnRow
    ? `${name}${displayId}`
    : !partName?.trim()
      ? `${name}${displayId}${XlLf}${formatKneelerAggregateStatusForExcel(k)}`
      : `${name}${displayId}${XlLf}${formatKneelerPartStatusForExcel(k, partName)}`;
  return trimTrailingNewlinesInCell(body);
}

function rowLabelText(row: PewRow): string {
  return trimTrailingNewlinesInCell(
    `${row.label}${XlLf}[${labelForRowFrontType(row.frontType)}]`,
  );
}

function sanitizeSheetName(raw: string, used: Set<string>): string {
  const cleaned = raw.replace(/[:\\/*?\[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31);
  let name = cleaned || "Section";
  let n = 1;
  while (used.has(name)) {
    const suffix = ` ${n++}`;
    name = (cleaned.slice(0, Math.max(1, 31 - suffix.length)) + suffix).trim();
  }
  used.add(name);
  return name;
}

function setGridBorders(
  ws: ExcelJS.Worksheet,
  fromRow: number,
  toRow: number,
  fromCol: number,
  toCol: number,
) {
  for (let rr = fromRow; rr <= toRow; rr++) {
    for (let cc = fromCol; cc <= toCol; cc++) {
      const cell = ws.getCell(rr, cc);
      const top = rr === fromRow ? thinSide("medium") : thinSide("thin");
      const bottom = rr === toRow ? thinSide("medium") : thinSide("thin");
      const left = cc === fromCol ? thinSide("medium") : thinSide("thin");
      const right = cc === toCol ? thinSide("medium") : thinSide("thin");
      cell.border = { top, bottom, left, right };
    }
  }
}

const CHURCH_SHEET_BASE_NAME = "Church";
const CHURCH_WEST_SHEET_BASE_NAME = "Church - West";
const CHURCH_EAST_SHEET_BASE_NAME = "Church - East";

type ChurchGridSide = "full" | "west" | "east";

function churchGridTitleSubtitle(side: ChurchGridSide): string {
  switch (side) {
    case "full":
      return "Church map (row grid)";
    case "west":
      return "Church map — West (row grid)";
    case "east":
      return "Church map — East (row grid)";
  }
}

/**
 * Kneeler cells only (columns `firstCol`…`lastCol`), matching section export geometry.
 * When `applyPewMapStatusFill`, non-pillar cells use the same status tints as the pew map.
 */
function writePewRowKneelersIntoGridColumns(
  ws: ExcelJS.Worksheet,
  r: number,
  firstCol: number,
  lastCol: number,
  section: PewSection,
  row: PewRow,
  partName: string,
  statusOnRow: boolean,
  applyPewMapStatusFill: boolean,
): void {
  const maxUnits = lastCol - firstCol + 1;
  const padEmptyOnLeft = emptyKneelerGridPadOnLeft(section);

  if (row.kneelers.length === 0) {
    if (maxUnits >= 1) {
      setEmptyPaddingRegion(ws, r, firstCol, lastCol);
    }
    return;
  }

  const rowUnits = rowDataColumnUnits(row, section);
  let col = firstCol;
  if (padEmptyOnLeft) {
    const leftPad = maxUnits - rowUnits;
    if (leftPad > 0) {
      setEmptyPaddingRegion(ws, r, firstCol, firstCol + leftPad - 1);
    }
    col = firstCol + leftPad;
  }
  if (useExplicitPewRailLayoutForExport(row)) {
    assertKneelersMatchPewSeatingOnExplicitRail(row);
    const segs = explicitPewRailSegments(row);
    const benchPewIdShownKneelers = new Set<string>();
    let kWalk = initKneelerWalkState(row);
    let pendingBench: PendingBenchMerge | null = null;
    const flushPendingBench = () => {
      if (!pendingBench) return;
      applyPendingBenchMerge(
        ws,
        r,
        pendingBench,
        section,
        row,
        partName,
        statusOnRow,
        benchPewIdShownKneelers,
        applyPewMapStatusFill,
      );
      pendingBench = null;
    };
    for (let si = 0; si < segs.length; si++) {
      const seg = segs[si]!;
      if (seg.variant === "gap") {
        flushPendingBench();
        const units = capacityToColumnUnits(seg.capacity);
        const endCol = col + units - 1;
        if (endCol > lastCol) {
          throw new Error(
            `Pew layout export: row ${row.id} overflow (span ends at ${endCol}, max ${lastCol})`,
          );
        }
        if (col < endCol) {
          ws.mergeCells(r, col, r, endCol);
        }
        const master = ws.getCell(r, col);
        master.value = PILLAR_GAP_EXPORT_LABEL;
        master.fill = pillarFill;
        master.font = { ...emptyPaddingFont };
        master.alignment = { horizontal: "center", vertical: "middle", wrapText: false };
        col = endCol + 1;
      } else {
        let cLeft = seg.capacity;
        while (cLeft > 0 && kWalk.ki < row.kneelers.length) {
          const k = row.kneelers[kWalk.ki]!;
          if (kWalk.rem === 0) {
            kWalk.rem = k.capacity;
          }
          const take = Math.min(cLeft, kWalk.rem);
          if (take <= 0) {
            break;
          }
          const sliceUnits = capacityToColumnUnits(take);
          const endCol = col + sliceUnits - 1;
          if (endCol > lastCol) {
            throw new Error(
              `Pew layout export: row ${row.id} overflow (span ends at ${endCol}, max ${lastCol})`,
            );
          }
          const extendSame =
            pendingBench !== null &&
            pendingBench.kneeler.id === k.id &&
            col === pendingBench.col1 + 1;
          if (extendSame) {
            pendingBench.col1 = endCol;
          } else {
            flushPendingBench();
            pendingBench = { kneeler: k, col0: col, col1: endCol };
          }
          col = endCol + 1;
          cLeft -= take;
          kWalk.rem -= take;
          if (kWalk.rem === 0) {
            kWalk.ki += 1;
            kWalk.rem = row.kneelers[kWalk.ki]?.capacity ?? 0;
          }
        }
        const prevSeg = si > 0 ? segs[si - 1]! : null;
        if (prevSeg?.variant === "gap" && cLeft < 0.05) {
          flushPendingBench();
        }
      }
    }
    flushPendingBench();
  } else {
    for (const kneeler of row.kneelers) {
      const units = capacityToColumnUnits(kneeler.capacity);
      const endCol = col + units - 1;
      if (endCol > lastCol) {
        throw new Error(
          `Pew layout export: row ${row.id} overflow (span ends at ${endCol}, max ${lastCol})`,
        );
      }
      if (col < endCol) {
        ws.mergeCells(r, col, r, endCol);
      }
      const master = ws.getCell(r, col);
      const displayId = formatBenchPewId(section, row, kneeler);
      master.value = cellTextForKneeler(
        kneeler,
        partName || undefined,
        displayId,
        statusOnRow,
      );
      master.alignment = { wrapText: true, vertical: "top", horizontal: "center" };
      if (isPillarKneeler(kneeler)) {
        master.fill = pillarFill;
        master.font = { size: 9, italic: true, color: { argb: "FF6B7280" } };
      } else if (applyPewMapStatusFill) {
        master.fill = MAP_GRID_STATUS_FILL[kneelerStatusForPart(kneeler, partName)];
      }
      col = endCol + 1;
    }
  }
  if (!padEmptyOnLeft && col <= lastCol) {
    setEmptyPaddingRegion(ws, r, col, lastCol);
  }
}

function maxZoneUnitsAcrossGridRows(
  rowNums: number[],
  pick: (n: number) => { section: PewSection; row: PewRow } | undefined,
): number {
  let m = 1;
  for (const n of rowNums) {
    const p = pick(n);
    if (p) {
      m = Math.max(m, rowDataColumnUnits(p.row, p.section));
    }
  }
  return m;
}

function churchGridPickers(sections: PewSection[]) {
  const westAll = sections
    .filter((s) => s.side === "west" && (s.type ?? "pews") === "pews")
    .slice()
    .sort((a, b) => a.group - b.group);
  const eastAll = sections
    .filter((s) => s.side === "east" && (s.type ?? "pews") === "pews")
    .slice()
    .sort((a, b) => a.group - b.group);
  const westOuter = sections.find((s) => s.side === "westOuter");
  const eastOuter = sections.find((s) => s.side === "eastOuter");
  const transeptSection = sections.find((s) => s.type === "crossAisle");
  const alignment = westAll[0]?.alignment ?? eastAll[0]?.alignment ?? "nave";

  function pickWest(n: number): { section: PewSection; row: PewRow } | undefined {
    for (const sec of westAll) {
      const row = sec.rows.find((rr) => parseMapRowNumber(rr) === n);
      if (row) return { section: sec, row };
    }
    return undefined;
  }

  function pickEast(n: number): { section: PewSection; row: PewRow } | undefined {
    for (const sec of eastAll) {
      const row = sec.rows.find((rr) => parseMapRowNumber(rr) === n);
      if (row) return { section: sec, row };
    }
    return undefined;
  }

  function pickOuter(
    section: PewSection | undefined,
    n: number,
  ): { section: PewSection; row: PewRow } | undefined {
    if (!section) return undefined;
    const row = section.rows.find((rr) => parseMapRowNumber(rr) === n);
    if (!row) return undefined;
    return { section, row };
  }

  return { westOuter, eastOuter, transeptSection, alignment, pickWest, pickEast, pickOuter };
}

function writeChurchAlignedGridToWorksheet(
  ws: ExcelJS.Worksheet,
  project: Project,
  layoutSections: PewSection[],
  partName: string,
  exportAt: Date,
  side: ChurchGridSide = "full",
): { lastRow: number; lastCol: number } {
  const { westOuter, eastOuter, transeptSection, alignment, pickWest, pickEast, pickOuter } =
    churchGridPickers(layoutSections);
  const transeptLabel = transeptSection?.label ?? "Transept";
  const rowNums = collectGridRowNumbers(layoutSections);
  const firstRowN = rowNums[0] ?? 0;

  const maxWo =
    westOuter != null
      ? maxZoneUnitsAcrossGridRows(rowNums, (n) => pickOuter(westOuter, n))
      : 0;
  const maxEo =
    eastOuter != null
      ? maxZoneUnitsAcrossGridRows(rowNums, (n) => pickOuter(eastOuter, n))
      : 0;
  const maxWest = maxZoneUnitsAcrossGridRows(rowNums, pickWest);
  const maxEast = maxZoneUnitsAcrossGridRows(rowNums, pickEast);
  const centerCols = alignment === "outer" ? 2 : 1;

  const includeWest = side === "full" || side === "west";
  const includeEast = side === "full" || side === "east";

  let colWoStart = 0;
  let colWoEnd = 0;
  let colWmark = 0;
  let colWestStart = 0;
  let colWestEnd = 0;
  let colCenterStart = 0;
  let colCenterEnd = 0;
  let colEastStart = 0;
  let colEastEnd = 0;
  let colEmark = 0;
  let colEoStart = 0;
  let colEoEnd = 0;

  let c = 2;
  if (includeWest) {
    if (maxWo > 0) {
      colWoStart = c;
      colWoEnd = c + maxWo - 1;
      c = colWoEnd + 1;
    }
    colWmark = c;
    c += 1;
    colWestStart = c;
    colWestEnd = c + maxWest - 1;
    c = colWestEnd + 1;
  }
  colCenterStart = c;
  colCenterEnd = c + centerCols - 1;
  c = colCenterEnd + 1;

  if (includeEast) {
    colEastStart = c;
    colEastEnd = c + maxEast - 1;
    c = colEastEnd + 1;
    colEmark = c;
    c += 1;
    if (maxEo > 0) {
      colEoStart = c;
      colEoEnd = c + maxEo - 1;
      c = colEoEnd + 1;
    }
  }

  const lastCol = c - 1;
  const partDisplay = partName || "—";
  const titleRow = 1;
  const headerRow = 2;
  const firstDataRow = 3;

  const title = ws.getCell(titleRow, 1);
  title.value = trimTrailingNewlinesInCell(
    `${project.name}${XlLf}${churchGridTitleSubtitle(side)}${XlLf}Part: ${partDisplay}${XlLf}${exportDateHeaderLine(exportAt)}`,
  );
  title.font = { bold: true, size: 12 };
  title.alignment = { vertical: "top", wrapText: true };
  if (lastCol > 1) {
    ws.mergeCells(titleRow, 1, titleRow, lastCol);
  }
  ws.getRow(titleRow).height = Math.max(
    PEW_TITLE_ROW_MIN_HEIGHT_PT,
    88 - PEW_SHEET_DEFAULT_ROW_HEIGHT_PT,
  );

  const headerCells: { c0: number; c1: number; label: string }[] = [];
  if (includeWest) {
    if (maxWo > 0) {
      headerCells.push({ c0: colWoStart, c1: colWoEnd, label: "West outer" });
    }
    headerCells.push({ c0: colWmark, c1: colWmark, label: "" });
    headerCells.push({ c0: colWestStart, c1: colWestEnd, label: "West" });
  }
  headerCells.push({ c0: colCenterStart, c1: colCenterEnd, label: "···" });
  if (includeEast) {
    headerCells.push({ c0: colEastStart, c1: colEastEnd, label: "East" });
    headerCells.push({ c0: colEmark, c1: colEmark, label: "" });
    if (maxEo > 0) {
      headerCells.push({ c0: colEoStart, c1: colEoEnd, label: "East outer" });
    }
  }

  ws.getCell(headerRow, 1).value = "Row";
  ws.getCell(headerRow, 1).font = { bold: true, size: 10 };
  ws.getCell(headerRow, 1).fill = headerFill;
  ws.getCell(headerRow, 1).alignment = { vertical: "middle", horizontal: "right", wrapText: false };

  for (const h of headerCells) {
    const cell = ws.getCell(headerRow, h.c0);
    cell.value = h.label;
    cell.font = { bold: true, size: 10 };
    cell.fill = headerFill;
    cell.alignment = { vertical: "middle", wrapText: false, horizontal: "center" };
    if (h.c0 < h.c1) {
      ws.mergeCells(headerRow, h.c0, headerRow, h.c1);
    }
  }

  let outI = 0;
  for (const n of rowNums) {
    const r = firstDataRow + outI;
    const rowNumCell = ws.getCell(r, 1);
    rowNumCell.value = n;
    rowNumCell.font = { size: 10 };
    rowNumCell.alignment = { horizontal: "right", vertical: "middle", wrapText: false };

    if (includeWest) {
      const wo = pickOuter(westOuter, n);
      if (maxWo > 0) {
        if (wo) {
          writePewRowKneelersIntoGridColumns(
            ws,
            r,
            colWoStart,
            colWoEnd,
            wo.section,
            wo.row,
            partName,
            false,
            true,
          );
        } else {
          setEmptyPaddingRegion(ws, r, colWoStart, colWoEnd);
        }
      }
      const wMark = ws.getCell(r, colWmark);
      wMark.value = n === firstRowN ? "W" : "";
      wMark.font = { size: 9, color: { argb: "FF6B7280" } };
      wMark.alignment = { horizontal: "center", vertical: "middle", wrapText: false };
      wMark.fill = emptyPaddingFill;
    }

    const isTranseptBand = n === 9 && Boolean(transeptSection);

    if (isTranseptBand) {
      if (side === "full") {
        ws.mergeCells(r, colWestStart, r, colEastEnd);
        const tr = ws.getCell(r, colWestStart);
        tr.value = transeptLabel;
        tr.font = { size: 10, italic: true, color: { argb: "FF6B7280" } };
        tr.alignment = { horizontal: "center", vertical: "middle", wrapText: false };
        tr.fill = emptyPaddingFill;
      } else if (side === "west") {
        ws.mergeCells(r, colWestStart, r, colCenterEnd);
        const tr = ws.getCell(r, colWestStart);
        tr.value = transeptLabel;
        tr.font = { size: 10, italic: true, color: { argb: "FF6B7280" } };
        tr.alignment = { horizontal: "center", vertical: "middle", wrapText: false };
        tr.fill = emptyPaddingFill;
      } else {
        ws.mergeCells(r, colCenterStart, r, colEastEnd);
        const tr = ws.getCell(r, colCenterStart);
        tr.value = transeptLabel;
        tr.font = { size: 10, italic: true, color: { argb: "FF6B7280" } };
        tr.alignment = { horizontal: "center", vertical: "middle", wrapText: false };
        tr.fill = emptyPaddingFill;
      }
    } else {
      if (includeWest) {
        const w = pickWest(n);
        if (w) {
          writePewRowKneelersIntoGridColumns(
            ws,
            r,
            colWestStart,
            colWestEnd,
            w.section,
            w.row,
            partName,
            false,
            true,
          );
        } else {
          setEmptyPaddingRegion(ws, r, colWestStart, colWestEnd);
        }
      }

      if (colCenterStart < colCenterEnd) {
        ws.mergeCells(r, colCenterStart, r, colCenterEnd);
      }
      const mid = ws.getCell(r, colCenterStart);
      mid.value = "";
      mid.fill = emptyPaddingFill;

      if (includeEast) {
        const e = pickEast(n);
        if (e) {
          writePewRowKneelersIntoGridColumns(
            ws,
            r,
            colEastStart,
            colEastEnd,
            e.section,
            e.row,
            partName,
            false,
            true,
          );
        } else {
          setEmptyPaddingRegion(ws, r, colEastStart, colEastEnd);
        }
      }
    }

    if (includeEast) {
      const eMark = ws.getCell(r, colEmark);
      eMark.value = n === firstRowN ? "E" : "";
      eMark.font = { size: 9, color: { argb: "FF6B7280" } };
      eMark.alignment = { horizontal: "center", vertical: "middle", wrapText: false };
      eMark.fill = emptyPaddingFill;

      if (maxEo > 0) {
        const eo = pickOuter(eastOuter, n);
        if (eo) {
          writePewRowKneelersIntoGridColumns(
            ws,
            r,
            colEoStart,
            colEoEnd,
            eo.section,
            eo.row,
            partName,
            false,
            true,
          );
        } else {
          setEmptyPaddingRegion(ws, r, colEoStart, colEoEnd);
        }
      }
    }

    if (isTranseptBand) {
      rowNumCell.fill = emptyPaddingFill;
      if (includeWest && maxWo > 0) {
        for (let cc = colWoStart; cc <= colWoEnd; cc++) {
          ws.getCell(r, cc).fill = emptyPaddingFill;
        }
      }
      if (includeEast && maxEo > 0) {
        for (let cc = colEoStart; cc <= colEoEnd; cc++) {
          ws.getCell(r, cc).fill = emptyPaddingFill;
        }
      }
    }

    ws.getRow(r).height = PEW_DATA_ROW_MIN_HEIGHT_PT;
    outI += 1;
  }

  const lastRow = firstDataRow + outI - 1;
  ws.getColumn(1).width = 8;
  for (let cc = 2; cc <= lastCol; cc++) {
    ws.getColumn(cc).width = WIDTH_UNITS_PER_PERSON / CAPACITY_TO_UNITS;
  }

  return { lastRow, lastCol };
}

/**
 * Writes one section’s title, header, and pew grid starting at `startRow`.
 * @param gridMaxUnits - When set, every row uses this grid width so stacked sections align on the Church sheet.
 */
function writePewSectionBlockToWorksheet(
  ws: ExcelJS.Worksheet,
  project: Project,
  section: PewSection,
  partName: string,
  exportAt: Date,
  startRow: number,
  gridMaxUnits?: number,
): { lastRow: number; lastCol: number } {
  const maxUnits = gridMaxUnits ?? maxDataColumnUnitsInSection(section);
  const lastCol = 1 + maxUnits;
  const titleRow = startRow;
  const headerRow = startRow + 1;
  const firstDataRow = startRow + 2;

  const partDisplay = partName || "—";
  const title = ws.getCell(titleRow, 1);
  title.value = trimTrailingNewlinesInCell(
    `${project.name}${XlLf}Section: ${section.label}${XlLf}Part: ${partDisplay}${XlLf}${exportDateHeaderLine(exportAt)}`,
  );
  title.font = { bold: true, size: 12 };
  title.alignment = { vertical: "top", wrapText: true };
  if (lastCol > 1) {
    ws.mergeCells(titleRow, 1, titleRow, lastCol);
  }
  ws.getRow(titleRow).height = Math.max(
    PEW_TITLE_ROW_MIN_HEIGHT_PT,
    88 - PEW_SHEET_DEFAULT_ROW_HEIGHT_PT,
  );

  ws.getCell(headerRow, 1).value = "Row";
  ws.getCell(headerRow, 1).font = { bold: true, size: 10 };
  ws.getCell(headerRow, 1).fill = headerFill;
  ws.getCell(headerRow, 1).alignment = { vertical: "middle", wrapText: false };
  if (maxUnits > 1) {
    ws.mergeCells(headerRow, 2, headerRow, lastCol);
  }
  const h2 = ws.getCell(headerRow, 2);
  h2.value = "Pews";
  h2.font = { bold: true, size: 10 };
  h2.fill = headerFill;
  h2.alignment = { vertical: "middle", wrapText: false, horizontal: "left" as const };

  let outRow = 0;

  if (section.rows.length === 0) {
    const cell = ws.getCell(firstDataRow, 1);
    cell.value = "No rows in this section.";
    cell.alignment = { wrapText: false };
    outRow = 1;
  } else {
    for (const row of section.rows) {
      const r = firstDataRow + outRow;
      const a = ws.getRow(r).getCell(1);
      a.font = { size: 10 };
      a.alignment = { wrapText: true, vertical: "top" };
      let rowHeight = 48;

      if (row.kneelers.length === 0) {
        a.value = `${rowLabelText(row)}${XlLf}(no kneelers; bench from pillar row)`;
        if (maxUnits >= 1) {
          setEmptyPaddingRegion(ws, r, 2, lastCol);
        }
      } else {
        const hoist = hoistedStatusForRow(row, partName);
        if (hoist) {
          rowHeight = Math.max(PEW_DATA_ROW_HOISTED_MIN_HEIGHT_PT, 60 - PEW_SHEET_DEFAULT_ROW_HEIGHT_PT);
        }
        a.value = trimTrailingNewlinesInCell(
          hoist ? `${rowLabelText(row)}${XlLf}${hoist}` : rowLabelText(row),
        );
        const statusOnRow = Boolean(hoist);
        writePewRowKneelersIntoGridColumns(
          ws,
          r,
          2,
          lastCol,
          section,
          row,
          partName,
          statusOnRow,
          false,
        );
      }

      ws.getRow(r).height = rowHeight;
      outRow += 1;
    }
  }

  const lastRow = section.rows.length === 0 ? firstDataRow : firstDataRow + outRow - 1;
  return { lastRow, lastCol };
}

export interface PewLayoutExcelOptions {
  sectionId?: string;
  /** When set, cell text follows this part only (aligns with pew map part filter). */
  partName?: string;
  /**
   * Used for the sheet title “Date: …” line. Defaults to the time of `buildPewLayoutWorkbook`
   * (e.g. pass a fixed date in unit tests).
   */
  exportDocumentDate?: Date;
}

/**
 * Worksheets “Church”, “Church - West”, and “Church - East”: row-grid maps (shared row column A).
 * Full Church matches the web; West/East omit the opposite side’s nave, outer, and aisle marker.
 * Kneeler cells use pew-map status tints. Then one worksheet per pew section. Cross-aisle
 * skipped on section sheets; included on church grids for transept band.
 */
export async function buildPewLayoutWorkbook(
  project: Project,
  options: PewLayoutExcelOptions = {},
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "tektonology-spa";
  wb.title = `${project.name} — pew layout`;
  const usedNames = new Set<string>();

  const sections = project.layout.sections.filter(
    (s) => !isCrossAisle(s) && (!options.sectionId || s.id === options.sectionId),
  );

  if (sections.length === 0) {
    const sheet = wb.addWorksheet("No pews");
    const noPews = sheet.getCell(1, 1);
    noPews.value = "No matching pew sections (check project data or section filter).";
    noPews.alignment = { wrapText: false };
    applyPewLayoutPrintPageSetup(sheet);
    return toUint8(await wb.xlsx.writeBuffer());
  }

  const partName = options.partName?.trim() ?? "";
  const exportAt = options.exportDocumentDate ?? new Date();
  const unitWidth = WIDTH_UNITS_PER_PERSON / CAPACITY_TO_UNITS;

  const layoutSectionsForGrid = project.layout.sections.filter((s) => {
    if (isCrossAisle(s)) return true;
    return !options.sectionId || s.id === options.sectionId;
  });

  const churchSheetName = sanitizeSheetName(CHURCH_SHEET_BASE_NAME, usedNames);
  const churchWs = wb.addWorksheet(churchSheetName, {
    properties: { defaultRowHeight: PEW_SHEET_DEFAULT_ROW_HEIGHT_PT },
  });
  const { lastRow: churchLastRow, lastCol: churchLastCol } = writeChurchAlignedGridToWorksheet(
    churchWs,
    project,
    layoutSectionsForGrid,
    partName,
    exportAt,
    "full",
  );
  setGridBorders(churchWs, 1, churchLastRow, 1, churchLastCol);
  applyPewLayoutPrintPageSetup(churchWs);

  const churchWestName = sanitizeSheetName(CHURCH_WEST_SHEET_BASE_NAME, usedNames);
  const churchWestWs = wb.addWorksheet(churchWestName, {
    properties: { defaultRowHeight: PEW_SHEET_DEFAULT_ROW_HEIGHT_PT },
  });
  const { lastRow: cwLastRow, lastCol: cwLastCol } = writeChurchAlignedGridToWorksheet(
    churchWestWs,
    project,
    layoutSectionsForGrid,
    partName,
    exportAt,
    "west",
  );
  setGridBorders(churchWestWs, 1, cwLastRow, 1, cwLastCol);
  applyPewLayoutPrintPageSetup(churchWestWs);

  const churchEastName = sanitizeSheetName(CHURCH_EAST_SHEET_BASE_NAME, usedNames);
  const churchEastWs = wb.addWorksheet(churchEastName, {
    properties: { defaultRowHeight: PEW_SHEET_DEFAULT_ROW_HEIGHT_PT },
  });
  const { lastRow: ceLastRow, lastCol: ceLastCol } = writeChurchAlignedGridToWorksheet(
    churchEastWs,
    project,
    layoutSectionsForGrid,
    partName,
    exportAt,
    "east",
  );
  setGridBorders(churchEastWs, 1, ceLastRow, 1, ceLastCol);
  applyPewLayoutPrintPageSetup(churchEastWs);

  for (const section of sections) {
    const sheetName = sanitizeSheetName(section.label, usedNames);
    const maxUnits = maxDataColumnUnitsInSection(section);
    const lastCol = 1 + maxUnits;
    const ws = wb.addWorksheet(sheetName, { properties: { defaultRowHeight: PEW_SHEET_DEFAULT_ROW_HEIGHT_PT } });
    const { lastRow } = writePewSectionBlockToWorksheet(ws, project, section, partName, exportAt, 1);
    setGridBorders(ws, 1, lastRow, 1, lastCol);

    ws.getColumn(1).width = 22;
    for (let c = 2; c <= lastCol; c++) {
      ws.getColumn(c).width = unitWidth;
    }

    applyPewLayoutPrintPageSetup(ws);
  }

  return toUint8(await wb.xlsx.writeBuffer());
}

function toUint8(buf: unknown): Uint8Array {
  if (buf instanceof ArrayBuffer) return new Uint8Array(buf);
  if (buf instanceof Uint8Array) return buf;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(buf)) {
    return new Uint8Array(buf);
  }
  return new Uint8Array(buf as ArrayBuffer);
}
