import { describe, it, expect } from "vitest";
import type { Kneeler, PewRow, PewSection } from "@/data/types";
import {
  formatBenchPewId,
  rowKeyForBenchDisplay,
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
  });
});
