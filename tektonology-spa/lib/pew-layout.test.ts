import { describe, it, expect } from "vitest";
import type { Kneeler, PewRow, PewSection } from "@/data/types";
import {
  isPillarKneeler,
  pewBenchSegmentsFromKneelers,
  pewBenchSegmentsFromContinuation,
  pewRailBarClass,
  pewRailColorClass,
} from "./pew-layout";

function k(id: string, capacity: number, label?: string): Kneeler {
  return {
    id,
    capacity,
    label,
    hardware: label === "Pillar" ? [] : [{ partId: "foot", name: "Kneeler Foot", quantity: 3, status: "unknown" }],
  };
}

describe("pew-layout", () => {
  it("exports pew rail classes", () => {
    expect(pewRailColorClass).toContain("d4b896");
    expect(pewRailBarClass).toContain(pewRailColorClass);
  });

  it("isPillarKneeler is true only when label is Pillar", () => {
    expect(isPillarKneeler(k("a", 3))).toBe(false);
    expect(isPillarKneeler(k("b", 2, "Pillar"))).toBe(true);
  });

  it("pewBenchSegmentsFromKneelers returns four 3p runs when a pillar kneeler exists", () => {
    const kneelers = [k("r1", 3), k("p", 2, "Pillar"), k("r2", 1)];
    const segs = pewBenchSegmentsFromKneelers(kneelers, "row-9");
    expect(segs).toHaveLength(4);
    expect(segs.every((s) => s.variant === "pew" && s.capacity === 3)).toBe(true);
    expect(segs.map((s) => s.id)).toEqual([
      "row-9-pew-run-0",
      "row-9-pew-run-1",
      "row-9-pew-run-2",
      "row-9-pew-run-3",
    ]);
  });

  it("pewBenchSegmentsFromKneelers maps one pew segment per kneeler when no pillar", () => {
    const kneelers = [k("a", 3), k("b", 3)];
    const segs = pewBenchSegmentsFromKneelers(kneelers);
    expect(segs).toEqual([
      { id: "a-bench", capacity: 3, variant: "pew" },
      { id: "b-bench", capacity: 3, variant: "pew" },
    ]);
  });

  it("pewBenchSegmentsFromContinuation returns null without continuation", () => {
    const section: PewSection = {
      id: "west-main",
      label: "West",
      type: "pews",
      side: "west",
      alignment: "nave",
      group: 0,
      rows: [],
    };
    const row: PewRow = { id: "row-10", label: "Row 10", frontType: "pew", kneelers: [] };
    expect(pewBenchSegmentsFromContinuation(section, row)).toBeNull();
  });

  it("pewBenchSegmentsFromContinuation returns null when fromRowId is missing", () => {
    const section: PewSection = {
      id: "west-main",
      label: "West",
      type: "pews",
      side: "west",
      alignment: "nave",
      group: 0,
      rows: [{ id: "row-9", label: "Row 9", frontType: "pew", kneelers: [] }],
    };
    const row: PewRow = {
      id: "row-10",
      label: "Row 10",
      frontType: "pew",
      kneelers: [],
      pillarBenchContinuation: { fromRowId: "missing", alignKneelerId: "x" },
    };
    expect(pewBenchSegmentsFromContinuation(section, row)).toBeNull();
  });

  it("pewBenchSegmentsFromContinuation maps previous row kneelers with gap at align id", () => {
    const prev: PewRow = {
      id: "row-9",
      label: "Row 9",
      frontType: "pew",
      kneelers: [k("r1", 3), k("pillar", 2, "Pillar"), k("r2", 3)],
    };
    const section: PewSection = {
      id: "west-main",
      label: "West",
      type: "pews",
      side: "west",
      alignment: "nave",
      group: 0,
      rows: [prev],
    };
    const row: PewRow = {
      id: "row-10",
      label: "Row 10",
      frontType: "pew",
      kneelers: [],
      pillarBenchContinuation: { fromRowId: "row-9", alignKneelerId: "pillar" },
    };
    const segs = pewBenchSegmentsFromContinuation(section, row);
    expect(segs).not.toBeNull();
    expect(segs!.find((s) => s.id === "row-10-pillar-bench")!.variant).toBe("gap");
    expect(segs!.filter((s) => s.variant === "pew")).toHaveLength(2);
  });
});
