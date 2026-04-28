import { describe, it, expect } from "vitest";
import type { Kneeler, PewRow, PewSection } from "@/data/types";
import {
  formatBenchPewId,
  benchPewIndex1BasedInRow,
  formatKneelerAggregateStatusForExcel,
  formatKneelerPartStatusForExcel,
  formatShortUsDate,
  rowKeyForBenchDisplay,
  sectionIdPrefixForBench,
  sectionLabelInitials,
  formatHardwareItemStatusForDetails,
} from "./pew-bench-display";

const sec = (overrides: Partial<PewSection> = {}): PewSection => ({
  id: "west-main",
  label: "West Main",
  type: "pews",
  side: "west",
  alignment: "nave",
  group: 0,
  rows: [],
  ...overrides,
});

describe("pew-bench-display", () => {
  it("derives section initials and row keys for bench ids", () => {
    expect(sectionLabelInitials("West Main")).toBe("wm");
    const row0: PewRow = {
      id: "r0w-1",
      label: "Row 0",
      frontType: "pew",
      kneelers: [],
    };
    expect(rowKeyForBenchDisplay(row0)).toBe("r0");
    const row9: PewRow = {
      id: "row-9",
      label: "Row 9",
      frontType: "pew",
      kneelers: [],
    };
    expect(rowKeyForBenchDisplay(row9)).toBe("r9");
  });

  it("formats wm-0001 style ids (row + pew, two digits each)", () => {
    const section = sec();
    const row: PewRow = {
      id: "r0w-1",
      label: "Row 0",
      frontType: "pew",
      kneelers: [
        { id: "r0w-1", capacity: 1, hardware: [] },
        { id: "r0w-2", capacity: 1, hardware: [] },
      ],
    };
    const k0 = row.kneelers[0]!;
    const k1 = row.kneelers[1]!;
    expect(formatBenchPewId(section, row, k0)).toBe("wm-0001");
    expect(formatBenchPewId(section, row, k1)).toBe("wm-0002");
  });

  it("row 1 pew 3 is wm-0103", () => {
    const section = sec();
    const row: PewRow = {
      id: "r1w-0",
      label: "Row 1",
      frontType: "pew",
      kneelers: [
        { id: "a", capacity: 1, hardware: [] },
        { id: "b", capacity: 1, hardware: [] },
        { id: "c", capacity: 1, hardware: [] },
      ],
    };
    const k3 = row.kneelers[2]!;
    expect(formatBenchPewId(section, row, k3)).toBe("wm-0103");
  });

  it("formats hardware line for details without part name", () => {
    expect(
      formatHardwareItemStatusForDetails({ partId: "a", name: "X", quantity: 1, status: "unknown" }),
    ).toBe("Unknown");
    expect(
      formatHardwareItemStatusForDetails({
        partId: "a",
        name: "X",
        quantity: 1,
        status: "needed",
        date: "2026-03-14",
      }),
    ).toMatch(/Needed: 3/);
    expect(
      formatHardwareItemStatusForDetails({ partId: "a", name: "X", quantity: 1, status: "needed" }),
    ).toBe("Needed");
    expect(
      formatHardwareItemStatusForDetails({
        partId: "a",
        name: "X",
        quantity: 1,
        status: "upcoming",
        date: "2026-01-01",
      }),
    ).toMatch(/Upcoming/);
    expect(
      formatHardwareItemStatusForDetails({
        partId: "a",
        name: "X",
        quantity: 1,
        status: "installed",
        date: "2026-06-01",
      }),
    ).toMatch(/Installed/);
  });

  it("formatShortUsDate passthroughs invalid input", () => {
    expect(formatShortUsDate("not a date")).toBe("not a date");
  });

  it("sectionIdPrefixForBench uses id when label has no letters", () => {
    const s1 = sec({ label: "", id: "west-wing" });
    expect(sectionIdPrefixForBench(s1)).toBe("ww");
    const s2 = sec({ label: "   ", id: "99-x" });
    expect(sectionIdPrefixForBench(s2)).toBe("9x");
    const s3 = sec({ label: "   ", id: "???" });
    expect(sectionIdPrefixForBench(s3)).toBe("x");
  });

  it("rowKeyForBenchDisplay covers id patterns and label fallback", () => {
    expect(rowKeyForBenchDisplay({ id: "r2", label: "x", frontType: "pew", kneelers: [] })).toBe("r2");
    expect(
      rowKeyForBenchDisplay({ id: "r3w-10", label: "x", frontType: "pew", kneelers: [] }),
    ).toBe("r3");
    expect(
      rowKeyForBenchDisplay({ id: "x-row-4", label: "x", frontType: "pew", kneelers: [] }),
    ).toBe("r4");
    expect(
      rowKeyForBenchDisplay({ id: "side-a", label: "Row 7", frontType: "pew", kneelers: [] }),
    ).toBe("r7");
    expect(
      rowKeyForBenchDisplay({ id: "odd", label: "No digits in label at all", frontType: "pew", kneelers: [] }),
    ).toBe("r0");
  });

  it("formatKneelerPartStatusForExcel uses part and kneeler state", () => {
    const k1: Kneeler = { id: "a", capacity: 1, hardware: [] };
    expect(formatKneelerPartStatusForExcel(k1, "Cushion")).toBe("");
    const k2: Kneeler = {
      id: "b",
      capacity: 1,
      hardware: [
        { partId: "1", name: "Cushion", quantity: 1, status: "installed", date: "2026-04-01" },
      ],
    };
    expect(formatKneelerPartStatusForExcel(k2, "Cushion")).toMatch(/Installed/);
    // Aggregate status is "upcoming" (mixed needed+installed) but no line has status "upcoming" → `?? items[0]`
    const kMixed: Kneeler = {
      id: "e",
      capacity: 1,
      hardware: [
        { partId: "1", name: "Cushion", quantity: 1, status: "needed" },
        { partId: "2", name: "Cushion", quantity: 1, status: "installed" },
      ],
    };
    expect(formatKneelerPartStatusForExcel(kMixed, "Cushion")).toMatch(/Needed/);
  });

  it("formatKneelerAggregateStatusForExcel picks priority and fallbacks", () => {
    expect(formatKneelerAggregateStatusForExcel({ id: "a", capacity: 1, hardware: [] })).toBe("");
    const k1: Kneeler = {
      id: "b",
      capacity: 1,
      hardware: [
        { partId: "1", name: "A", quantity: 1, status: "unknown" as const, date: "2026-01-01" },
        { partId: "2", name: "B", quantity: 1, status: "unknown" as const },
      ],
    };
    expect(formatKneelerAggregateStatusForExcel(k1)).toBe("");
    const k2: Kneeler = {
      id: "c",
      capacity: 1,
      hardware: [
        { partId: "1", name: "A", quantity: 1, status: "upcoming" as const, date: "2026-01-01" },
        { partId: "2", name: "B", quantity: 1, status: "unknown" as const },
      ],
    };
    expect(formatKneelerAggregateStatusForExcel(k2)).toMatch(/Upcoming/);
    const k3: Kneeler = {
      id: "d",
      capacity: 1,
      hardware: [{ partId: "1", name: "A", quantity: 1, status: "weird" as never }] as Kneeler["hardware"],
    };
    expect(formatKneelerAggregateStatusForExcel(k3)).toBe("");
  });

  it("benchPewIndex1BasedInRow skips pillars and default when missing", () => {
    const kneelers: Kneeler[] = [
      { id: "p", capacity: 1, label: "Pillar", hardware: [] },
      { id: "a", capacity: 1, hardware: [] },
    ];
    expect(benchPewIndex1BasedInRow(kneelers, kneelers[1]!)).toBe(1);
    expect(
      benchPewIndex1BasedInRow(
        [kneelers[1]!],
        { id: "nope", capacity: 1, hardware: [] } as Kneeler,
      ),
    ).toBe(1);
  });
});
