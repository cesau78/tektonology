import ExcelJS from "exceljs";
import type { Kneeler, Project, PewRow, PewSection } from "@/data/types";
import { emptyKneelerGridPadOnLeft, isPillarKneeler, type PewBenchSegment } from "@/lib/pew-layout";
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

function applyPendingBenchMerge(
  ws: ExcelJS.Worksheet,
  r: number,
  pending: PendingBenchMerge,
  section: PewSection,
  row: PewRow,
  partName: string,
  statusOnRow: boolean,
  benchPewIdShownKneelers: Set<string>,
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
  master.alignment = { wrapText: true, vertical: "top" };
  if (isPillarKneeler(kneeler)) {
    master.fill = pillarFill;
    master.font = { size: 9, italic: true, color: { argb: "FF6B7280" } };
  }
}

const thinSide = (style: "thin" | "medium" = "thin") =>
  style === "medium"
    ? { style: "medium" as const, color: { argb: "FF333333" } }
    : { style: "thin" as const, color: { argb: "FF888888" } };

const pillarFill: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFEAECF0" },
};

const headerFill: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF3F4F6" },
};

/** Trailing width padding (row shorter than section) or an all-empty kneeler row. */
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

/** e.g. `B` → 2, `AA` → 27. */
function excelColumnLettersToNumber(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.codePointAt(0)! - 64);
  }
  return n;
}

/**
 * After `setGridBorders`, every narrow column in a merge still had left+right
 * “thin” borders, so a single kneeler merge looked like many stacked boxes.
 * Clear interior verticals so only the outer left/right of each horizontal merge
 * (one row) draw a line.
 */
function stripInteriorVerticalBordersInSingleRowMerges(ws: ExcelJS.Worksheet) {
  const specs = (ws as unknown as { model?: { merges?: string[] } }).model?.merges;
  if (!Array.isArray(specs)) {
    return;
  }
  for (const spec of specs) {
    const m = spec.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
    if (!m) continue;
    const c0 = excelColumnLettersToNumber(m[1]!);
    const r0 = parseInt(m[2]!, 10);
    const c1 = excelColumnLettersToNumber(m[3]!);
    const r1 = parseInt(m[4]!, 10);
    if (r0 !== r1 || c0 >= c1) continue;
    for (let cc = c0; cc <= c1; cc++) {
      const cell = ws.getCell(r0, cc);
      const b = cell.border;
      if (!b) continue;
      const top = b.top;
      const bottom = b.bottom;
      const left = cc === c0 ? b.left : undefined;
      const right = cc === c1 ? b.right : undefined;
      cell.border = { top, bottom, left, right };
    }
  }
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
 * One worksheet per pew section: column A = row; B onward = a fixed grid of
 * narrow columns. Each kneeler spans a merge whose width in columns is
 * round(capacity×${CAPACITY_TO_UNITS}) (small integers, not hundredths). Each narrow column’s
 * width is ${WIDTH_UNITS_PER_PERSON}/${CAPACITY_TO_UNITS} so a capacity-1.0 cell spans
 * ${CAPACITY_TO_UNITS}× and totals width ${WIDTH_UNITS_PER_PERSON}. Shorter rows are padded
 * with empty unit columns on the right (west) or left (east), matching the pew map.
 * Cross-aisle sections skipped.
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

  for (const section of sections) {
    const padEmptyOnLeft = emptyKneelerGridPadOnLeft(section);
    const sheetName = sanitizeSheetName(section.label, usedNames);
    const maxUnits = maxDataColumnUnitsInSection(section);
    const lastCol = 1 + maxUnits;
    const ws = wb.addWorksheet(sheetName, { properties: { defaultRowHeight: PEW_SHEET_DEFAULT_ROW_HEIGHT_PT } });

    const partDisplay = partName || "—";
    const title = ws.getCell(1, 1);
    title.value = trimTrailingNewlinesInCell(
      `${project.name}${XlLf}Section: ${section.label}${XlLf}Part: ${partDisplay}${XlLf}${exportDateHeaderLine(exportAt)}`,
    );
    title.font = { bold: true, size: 12 };
    title.alignment = { vertical: "top", wrapText: true };
    if (lastCol > 1) {
      ws.mergeCells(1, 1, 1, lastCol);
    }
    ws.getRow(1).height = Math.max(
      PEW_TITLE_ROW_MIN_HEIGHT_PT,
      88 - PEW_SHEET_DEFAULT_ROW_HEIGHT_PT,
    );

    ws.getCell(2, 1).value = "Row";
    ws.getCell(2, 1).font = { bold: true, size: 10 };
    ws.getCell(2, 1).fill = headerFill;
    ws.getCell(2, 1).alignment = { vertical: "middle", wrapText: false };
    if (maxUnits > 1) {
      ws.mergeCells(2, 2, 2, lastCol);
    }
    const h2 = ws.getCell(2, 2);
    h2.value = "Pews";
    h2.font = { bold: true, size: 10 };
    h2.fill = headerFill;
    h2.alignment = { vertical: "middle", wrapText: false, horizontal: "left" as const };

    const firstDataRow = 3;
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
          const rowUnits = rowDataColumnUnits(row, section);
          let col = 2;
          if (padEmptyOnLeft) {
            const leftPad = maxUnits - rowUnits;
            if (leftPad > 0) {
              setEmptyPaddingRegion(ws, r, 2, 1 + leftPad);
            }
            col = 2 + leftPad;
          }
          const statusOnRow = Boolean(hoist);
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
                  // After a pillar, do not let extendSame continue the same kneeler into the next pew
                  // segment (3,2,1,3,3) — a 1p run must stay as its own column block, not merge with
                  // the first part of 3p (which looked like 3+3+1). Adjacent pew|pew without a gap
                  // (e.g. 2.66+ across [3,3,3] segments) still uses extendSame.
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
              master.alignment = { wrapText: true, vertical: "top" };
              if (isPillarKneeler(kneeler)) {
                master.fill = pillarFill;
                master.font = { size: 9, italic: true, color: { argb: "FF6B7280" } };
              }
              col = endCol + 1;
            }
          }
          if (!padEmptyOnLeft && col <= lastCol) {
            setEmptyPaddingRegion(ws, r, col, lastCol);
          }
        }

        ws.getRow(r).height = rowHeight;
        outRow += 1;
      }
    }

    const lastRow = section.rows.length === 0 ? firstDataRow : firstDataRow + outRow - 1;
    setGridBorders(ws, 1, lastRow, 1, lastCol);
    stripInteriorVerticalBordersInSingleRowMerges(ws);

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
