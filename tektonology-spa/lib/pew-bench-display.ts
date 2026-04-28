import type { HardwareItem, Kneeler, PewRow, PewSection } from "@/data/types";
import { isPillarKneeler, kneelerStatusForPart } from "./pew-layout";

/** e.g. "3/14/26" for en-US. */
export function formatShortUsDate(input: string): string {
  const t = Date.parse(input);
  if (Number.isNaN(t)) return input;
  return new Date(t).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

/** Lowercase initials from words, e.g. "West Main" → "wm". */
export function sectionLabelInitials(label: string): string {
  return label
    .split(/[^a-zA-Z0-9]+/)
    .filter((w) => w.length > 0)
    .map((w) => w[0]!.toLowerCase())
    .join("");
}

export function sectionIdPrefixForBench(section: PewSection): string {
  const a = sectionLabelInitials(section.label);
  if (a) return a;
  return sectionLabelInitials(section.id) || "x";
}

/**
 * Row key for bench IDs, e.g. "r0" for row id "r0w-1" or "row-0" or label "Row 0".
 */
export function rowKeyForBenchDisplay(row: PewRow): string {
  const id = row.id;
  const exactR = id.match(/^r(\d+)$/i);
  if (exactR) return `r${exactR[1]}`;
  const m1 = id.match(/^r(\d+)w-\d+$/i);
  if (m1) return `r${m1[1]}`;
  const m2 = id.match(/^row-(\d+)$/i);
  if (m2) return `r${m2[1]}`;
  const m3 = id.match(/row-?(\d+)/i);
  if (m3) return `r${m3[1]}`;
  const m4 = row.label?.match(/(\d+)/);
  if (m4) return `r${m4[1]}`;
  return "r0";
}

/** Numeric row index (e.g. 0 for `r0`, 10 for `r10`) from the same rules as `rowKeyForBenchDisplay`. */
export function rowNumberForBenchId(row: PewRow): number {
  const key = rowKeyForBenchDisplay(row);
  return parseInt(key.slice(1), 10) || 0;
}

/** 1-based index among non-pillar kneelers left-to-right. */
export function benchPewIndex1BasedInRow(kneelers: Kneeler[], kneeler: Kneeler): number {
  let n = 0;
  for (const k of kneelers) {
    if (isPillarKneeler(k)) continue;
    n += 1;
    if (k.id === kneeler.id) return n;
  }
  return 1;
}

/**
 * `{sectionInitials}-{row2}{pew2}` (four digits: two for row, two for 1-based pew#).
 * e.g. row 0 pew 2 → `wm-0002`; row 1 pew 3 → `wm-0103`.
 */
export function formatBenchPewId(section: PewSection, row: PewRow, kneeler: Kneeler): string {
  const pre = sectionIdPrefixForBench(section);
  const rowNum = rowNumberForBenchId(row);
  const pewNum = benchPewIndex1BasedInRow(row.kneelers, kneeler);
  return `${pre}-${String(rowNum).padStart(2, "0")}${String(pewNum).padStart(2, "0")}`;
}

/** One line per hardware row in kneeler details: "Unknown" or "Needed: 3/14/26" (no part name). */
export function formatHardwareItemStatusForDetails(h: HardwareItem): string {
  if (h.status === "unknown") return "Unknown";
  const label =
    h.status === "needed"
      ? "Needed"
      : h.status === "upcoming"
        ? "Upcoming"
        : h.status === "installed"
          ? "Installed"
          : "Unknown";
  if (!h.date) return label;
  return `${label}: ${formatShortUsDate(h.date)}`;
}

/** Pew layout xlsx: omit the word "Unknown" so cells stay visually blank like empty map strips. */
function excelExportStatusLine(line: string): string {
  return line === "Unknown" ? "" : line;
}

export function formatKneelerPartStatusForExcel(k: Kneeler, partName: string): string {
  const part = partName.trim();
  const items = k.hardware.filter((h) => h.name === part);
  if (items.length === 0) return "";
  const st = kneelerStatusForPart(k, part);
  const h = items.find((x) => x.status === st) ?? items[0]!;
  return excelExportStatusLine(formatHardwareItemStatusForDetails(h));
}

/** Requires `k.hardware.length > 0` (see `formatKneelerAggregateStatusForExcel`). */
function pickPriorityHardwareItem(k: Kneeler): HardwareItem {
  const order: Array<"needed" | "upcoming" | "installed" | "unknown"> = [
    "needed",
    "upcoming",
    "installed",
    "unknown",
  ];
  for (const st of order) {
    const h = k.hardware.find((x) => x.status === st);
    if (h) return h;
  }
  return k.hardware[0]!;
}

export function formatKneelerAggregateStatusForExcel(k: Kneeler): string {
  if (k.hardware.length === 0) return "";
  return excelExportStatusLine(formatHardwareItemStatusForDetails(pickPriorityHardwareItem(k)));
}
