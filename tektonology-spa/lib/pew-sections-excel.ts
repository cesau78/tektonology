import ExcelJS from "exceljs";
import type { Kneeler, Project, PewRow, PewSection } from "@/data/types";
import { isPillarKneeler } from "@/lib/pew-layout";

/** Grid columns per 1.0 capacity; keeps spans small (e.g. 1→3, 2.66→8, 3→9) without hundredths. */
const CAPACITY_TO_UNITS = 3;
/** Total Excel “column width” for one full capacity-1.0 in those units (3 units × this/3 = 8). */
const WIDTH_UNITS_PER_PERSON = 8;

function capacityToColumnUnits(capacity: number): number {
  if (!Number.isFinite(capacity) || capacity <= 0) {
    return 1;
  }
  return Math.max(1, Math.round(capacity * CAPACITY_TO_UNITS));
}

function rowDataColumnUnits(row: PewRow): number {
  if (row.kneelers.length === 0) {
    return 0;
  }
  return row.kneelers.reduce((s, k) => s + capacityToColumnUnits(k.capacity), 0);
}

function maxDataColumnUnitsInSection(section: PewSection): number {
  if (section.rows.length === 0) {
    return 1;
  }
  return Math.max(1, ...section.rows.map(rowDataColumnUnits));
}

function kneelerOverallStatus(k: Kneeler) {
  if (k.hardware.length === 0) return "Unknown";
  const statuses = k.hardware.map((h) => h.status);
  if (statuses.every((s) => s === "installed")) return "Installed";
  if (statuses.some((s) => s === "installed" || s === "upcoming")) return "Upcoming";
  if (statuses.some((s) => s === "needed")) return "Parts needed";
  return "Unknown";
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

function isCrossAisle(s: PewSection) {
  return s.type === "crossAisle";
}

function cellTextForKneeler(k: Kneeler): string {
  if (isPillarKneeler(k)) {
    return "Pillar (structural gap)";
  }
  const st = kneelerOverallStatus(k);
  const name = k.label ? `${k.label}\n` : "";
  return `${name}${k.id}\n${k.capacity}p · ${st}`;
}

const frontTypeLabel: Record<string, string> = {
  communionRail: "Communion rail",
  pew: "Pew front",
};

function rowLabelText(row: PewRow): string {
  const front = frontTypeLabel[row.frontType] ?? row.frontType;
  return `${row.label}\n[${front}]`;
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

export interface PewLayoutExcelOptions {
  sectionId?: string;
}

const scaleHint = `1 person ≈ ${CAPACITY_TO_UNITS} narrow columns, total width ${WIDTH_UNITS_PER_PERSON} (e.g. 2.66p → ${capacityToColumnUnits(2.66)} cols, 1p → ${capacityToColumnUnits(1)} cols).`;

/**
 * One worksheet per pew section: column A = church row; B onward = a fixed grid of
 * narrow columns. Each kneeler spans a merge whose width in columns is
 * round(capacity×${CAPACITY_TO_UNITS}) (small integers, not hundredths). Each narrow column’s
 * width is ${WIDTH_UNITS_PER_PERSON}/${CAPACITY_TO_UNITS} so a capacity-1.0 cell spans
 * ${CAPACITY_TO_UNITS}× and totals width ${WIDTH_UNITS_PER_PERSON}. Rows are left-aligned;
 * shorter rows are padded on the right with empty unit columns. Cross-aisle sections skipped.
 */
export async function buildPewLayoutWorkbook(
  project: Project,
  options: PewLayoutExcelOptions = {},
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "tektonology-spa";
  wb.title = `${project.id} — pew layout`;
  const usedNames = new Set<string>();

  const sections = project.layout.sections.filter(
    (s) => !isCrossAisle(s) && (!options.sectionId || s.id === options.sectionId),
  );

  if (sections.length === 0) {
    const sheet = wb.addWorksheet("No pews");
    sheet.getCell(1, 1).value =
      "No matching pew sections (check project data or section filter).";
    return toUint8(await wb.xlsx.writeBuffer());
  }

  const unitWidth = WIDTH_UNITS_PER_PERSON / CAPACITY_TO_UNITS;

  for (const section of sections) {
    const sheetName = sanitizeSheetName(section.label, usedNames);
    const maxUnits = maxDataColumnUnitsInSection(section);
    const lastCol = 1 + maxUnits;
    const ws = wb.addWorksheet(sheetName, { properties: { defaultRowHeight: 18 } });

    const subMeta =
      section.side === "full"
        ? "Full width"
        : `${section.side} · ${
            section.alignment === "outer" ? "Outer" : section.alignment === "nave" ? "Nave" : "Full"
          } aligned`;

    const title = ws.getCell(1, 1);
    title.value = `${section.label}\n${subMeta} · ${project.name}`;
    title.font = { bold: true, size: 12 };
    title.alignment = { vertical: "middle", wrapText: true };
    if (lastCol > 1) {
      ws.mergeCells(1, 1, 1, lastCol);
    }
    ws.getRow(1).height = 44;

    ws.getCell(2, 1).value = "Church row";
    ws.getCell(2, 1).font = { bold: true, size: 10 };
    ws.getCell(2, 1).fill = headerFill;
    ws.getCell(2, 1).alignment = { vertical: "middle" };
    if (maxUnits > 1) {
      ws.mergeCells(2, 2, 2, lastCol);
    }
    const h2 = ws.getCell(2, 2);
    h2.value = `Kneelers (L→R). ${scaleHint}`;
    h2.font = { bold: true, size: 8 };
    h2.fill = headerFill;
    h2.alignment = { vertical: "middle", wrapText: true, horizontal: "left" as const };

    const firstDataRow = 3;
    let outRow = 0;

    if (section.rows.length === 0) {
      const cell = ws.getCell(firstDataRow, 1);
      cell.value = "No rows in this section.";
      cell.alignment = { wrapText: true };
      outRow = 1;
    } else {
      for (const row of section.rows) {
        const r = firstDataRow + outRow;
        const a = ws.getRow(r).getCell(1);
        a.font = { size: 10 };
        a.alignment = { wrapText: true, vertical: "top" };

        if (row.kneelers.length === 0) {
          a.value = `${rowLabelText(row)}\n(no kneelers; bench from pillar row)`;
          if (maxUnits > 1) {
            ws.mergeCells(r, 2, r, lastCol);
            const b = ws.getCell(r, 2);
            b.value = "—";
            b.alignment = { horizontal: "center" as const, vertical: "middle" };
          } else if (maxUnits === 1) {
            const b = ws.getCell(r, 2);
            b.value = "—";
            b.alignment = { horizontal: "center" as const, vertical: "middle" };
          }
        } else {
          a.value = rowLabelText(row);
          let col = 2;
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
            master.value = cellTextForKneeler(kneeler);
            master.alignment = { wrapText: true, vertical: "top" };
            if (isPillarKneeler(kneeler)) {
              master.fill = pillarFill;
              master.font = { size: 9, italic: true, color: { argb: "FF6B7280" } };
            }
            col = endCol + 1;
          }
        }

        ws.getRow(r).height = 48;
        outRow += 1;
      }
    }

    const lastRow = section.rows.length === 0 ? firstDataRow : firstDataRow + outRow - 1;
    setGridBorders(ws, 1, lastRow, 1, lastCol);

    ws.getColumn(1).width = 22;
    for (let c = 2; c <= lastCol; c++) {
      ws.getColumn(c).width = unitWidth;
    }
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
