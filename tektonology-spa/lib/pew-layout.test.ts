import { describe, it, expect } from "vitest";
import type { Kneeler, PewRow, PewSection } from "@/data/types";
import {
  isPillarKneeler,
  kneelerStatusForPart,
  pewBenchSegmentsFromKneelers,
  pewBenchSegmentsFromContinuation,
  pewRailSegmentsForRow,
  pewRailBarClass,
  pewRailColorClass,
  rowCapacitySum,
  effectiveRowCapacityForMap,
  maxRowCapacityInSection,
  alignRowStripWidthPercent,
  emptyKneelerGridPadOnLeft,
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

  it("kneelerStatusForPart matches hardware lines for the given part name", () => {
    const kneeler: Kneeler = {
      id: "k1",
      capacity: 3,
      hardware: [
        { partId: "a", name: "Kneeler Foot", quantity: 2, status: "installed" },
        { partId: "b", name: "Other", quantity: 1, status: "needed" },
      ],
    };
    expect(kneelerStatusForPart(kneeler, "Kneeler Foot")).toBe("installed");
    expect(kneelerStatusForPart(kneeler, "Other")).toBe("needed");
    expect(kneelerStatusForPart(kneeler, "Missing")).toBe("none");
    expect(kneelerStatusForPart({ ...kneeler, hardware: [] }, "Kneeler Foot")).toBe("none");
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

  it("alignRowStripWidthPercent uses max row sum as ref when mapRowAlignRefCapacity omitted", () => {
    const section = {
      id: "s",
      label: "S",
      type: "pews",
      side: "west",
      alignment: "nave",
      group: 0,
      mapRowAlign: "start" as const,
      rows: [
        { id: "a", label: "A", frontType: "pew" as const, kneelers: [k("x", 3), k("y", 3), k("z", 3)] },
        { id: "b", label: "B", frontType: "pew" as const, kneelers: [k("a", 3), k("b", 3), k("c", 3), k("d", 3)] },
      ],
    } satisfies PewSection;
    expect(alignRowStripWidthPercent(section, 9)).toBe(75);
  });

  it("alignRowStripWidthPercent returns 100 for fill alignment", () => {
    const section = {
      id: "s",
      label: "S",
      type: "pews",
      side: "west",
      alignment: "nave",
      group: 0,
      mapRowAlign: "fill" as const,
      rows: [{ id: "a", label: "A", frontType: "pew" as const, kneelers: [k("x", 3)] }],
    } satisfies PewSection;
    expect(alignRowStripWidthPercent(section, 5)).toBe(100);
  });

  it("alignRowStripWidthPercent treats missing mapRowAlign as fill", () => {
    const section = {
      id: "s",
      label: "S",
      type: "pews",
      side: "west",
      alignment: "nave",
      group: 0,
      rows: [{ id: "a", label: "A", frontType: "pew" as const, kneelers: [k("x", 3)] }],
    } satisfies PewSection;
    expect(alignRowStripWidthPercent(section, 3)).toBe(100);
  });

  it("alignRowStripWidthPercent returns 100 when ref capacity is zero", () => {
    const section = {
      id: "s",
      label: "S",
      type: "pews",
      side: "west",
      alignment: "nave",
      group: 0,
      mapRowAlign: "start" as const,
      mapRowAlignRefCapacity: 0,
      rows: [],
    } satisfies PewSection;
    expect(alignRowStripWidthPercent(section, 3)).toBe(100);
  });

  it("alignRowStripWidthPercent caps row 3 at 100% when ref is 9", () => {
    const section = {
      id: "s",
      label: "S",
      type: "pews",
      side: "west",
      alignment: "nave",
      group: 0,
      mapRowAlign: "start" as const,
      mapRowAlignRefCapacity: 9,
      rows: [
        { id: "a", label: "A", frontType: "pew" as const, kneelers: [k("x", 3), k("y", 3), k("z", 3)] },
        { id: "b", label: "B", frontType: "pew" as const, kneelers: [k("a", 3), k("b", 3), k("c", 3), k("d", 3)] },
      ],
    } satisfies PewSection;
    expect(alignRowStripWidthPercent(section, 9)).toBe(100);
    expect(alignRowStripWidthPercent(section, 12)).toBe(100);
  });

  it("rowCapacitySum and maxRowCapacityInSection", () => {
    const rowA = { id: "a", label: "A", frontType: "pew" as const, kneelers: [k("x", 3), k("y", 2)] };
    const rowB = { id: "b", label: "B", frontType: "pew" as const, kneelers: [k("z", 4)] };
    const sectionBase = {
      id: "s",
      label: "S",
      type: "pews",
      side: "west",
      alignment: "nave",
      group: 0,
    } as const;
    expect(rowCapacitySum(rowA)).toBe(5);
    expect(
      maxRowCapacityInSection({
        ...sectionBase,
        rows: [rowA, rowB],
      }),
    ).toBe(5);
    expect(maxRowCapacityInSection({ ...sectionBase, rows: [] })).toBe(0);
  });

  it("effectiveRowCapacityForMap uses continuation or pew rail widths when kneelers empty", () => {
    const sectionBase = {
      id: "s",
      label: "S",
      type: "pews",
      side: "west",
      alignment: "nave",
      group: 0,
    } as const;
    const prev: PewRow = {
      id: "row-9",
      label: "Row 9",
      frontType: "pew",
      kneelers: [k("a", 3), k("b", 3), k("c", 3), k("d", 3)],
    };
    const section = { ...sectionBase, rows: [prev] };
    const rowCont: PewRow = {
      id: "row-10",
      label: "Row 10",
      frontType: "pew",
      kneelers: [],
      pillarBenchContinuation: { fromRowId: "row-9", alignKneelerId: "a" },
    };
    expect(effectiveRowCapacityForMap(rowCont, section)).toBe(12);
    const prevSmall: PewRow = {
      id: "row-9",
      label: "Row 9",
      frontType: "pew",
      kneelers: [k("a", 3), k("b", 3)],
    };
    const rowContRailWider: PewRow = {
      id: "row-10",
      label: "Row 10",
      frontType: "pew",
      kneelers: [],
      pewRailSegmentWidths: [3, 3, 3, 3],
      pillarBenchContinuation: { fromRowId: "row-9", alignKneelerId: "a" },
    };
    expect(effectiveRowCapacityForMap(rowContRailWider, { ...sectionBase, rows: [prevSmall] })).toBe(12);
    const rowRail: PewRow = {
      id: "x",
      label: "X",
      frontType: "pew",
      kneelers: [],
      pewRailSegmentWidths: [3, 2, 1],
    };
    expect(effectiveRowCapacityForMap(rowRail, { ...sectionBase, rows: [rowRail] })).toBe(6);
    const rowMissingPrev: PewRow = {
      id: "row-10",
      label: "Row 10",
      frontType: "pew",
      kneelers: [],
      pillarBenchContinuation: { fromRowId: "missing", alignKneelerId: "x" },
      pewRailSegmentWidths: [3, 3],
    };
    expect(effectiveRowCapacityForMap(rowMissingPrev, { ...sectionBase, rows: [] })).toBe(6);
  });

  it("effectiveRowCapacityForMap uses max of kneeler and pew rail sums when both set", () => {
    const sectionBase = {
      id: "s",
      label: "S",
      type: "pews",
      side: "west",
      alignment: "nave",
      group: 0,
    } as const;
    const row: PewRow = {
      id: "row-1",
      label: "Row 1",
      frontType: "pew",
      pewRailSegmentWidths: [3, 3, 3],
      kneelers: [k("a", 2.33), k("b", 2.33), k("c", 1), k("d", 2.33)],
    };
    expect(effectiveRowCapacityForMap(row, { ...sectionBase, rows: [row] })).toBe(9);
  });

  it("pewRailSegmentsForRow uses explicit widths and gap kinds", () => {
    const section: PewSection = {
      id: "s",
      label: "S",
      type: "pews",
      side: "west",
      alignment: "nave",
      group: 0,
      rows: [],
    };
    const row: PewRow = {
      id: "row-10",
      label: "Row 10",
      frontType: "pew",
      kneelers: [],
      pewRailSegmentWidths: [3, 2, 1],
      pewRailSegmentKinds: ["pew", "gap", "pew"],
    };
    const segs = pewRailSegmentsForRow(section, row);
    expect(segs).toEqual([
      { id: "row-10-pew-rail-0", capacity: 3, variant: "pew" },
      { id: "row-10-pew-rail-1", capacity: 2, variant: "gap" },
      { id: "row-10-pew-rail-2", capacity: 1, variant: "pew" },
    ]);
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

  describe("emptyKneelerGridPadOnLeft", () => {
    const base = (): PewSection => ({
      id: "s",
      label: "S",
      type: "pews",
      side: "west",
      alignment: "nave",
      group: 0,
      rows: [],
    });

    it("is true for mapRowAlign end and false for start", () => {
      expect(emptyKneelerGridPadOnLeft({ ...base(), mapRowAlign: "end" })).toBe(true);
      expect(emptyKneelerGridPadOnLeft({ ...base(), mapRowAlign: "start" })).toBe(false);
    });

    it("is false for fill even on east", () => {
      expect(emptyKneelerGridPadOnLeft({ ...base(), mapRowAlign: "fill" })).toBe(false);
      expect(
        emptyKneelerGridPadOnLeft({ ...base(), side: "east", mapRowAlign: "fill" }),
      ).toBe(false);
    });

    it("when mapRowAlign is omitted, uses east and eastOuter as end", () => {
      expect(emptyKneelerGridPadOnLeft({ ...base(), side: "east" })).toBe(true);
      expect(emptyKneelerGridPadOnLeft({ ...base(), side: "west" })).toBe(false);
      expect(emptyKneelerGridPadOnLeft({ ...base(), side: "eastOuter" })).toBe(true);
    });
  });
});
