import { describe, it, expect } from "vitest";
import type { Kneeler } from "@/data/types";
import {
  defaultPartFilter,
  partDisplaySegmentsForPartOnKneeler,
  partDisplaySegmentsShouldSplit,
  sortHardwareItemsForPartDisplay,
} from "./hardware-part-segments";
import type { PewSection } from "@/data/types";

describe("hardware-part-segments", () => {
  it("expands quantity 2 without side into left and right", () => {
    const k: Kneeler = {
      id: "k1",
      capacity: 3,
      hardware: [
        {
          partId: "plate",
          name: "Kneeler Plates",
          quantity: 2,
          status: "needed",
        },
      ],
    };
    const segs = partDisplaySegmentsForPartOnKneeler(k, "Kneeler Plates");
    expect(segs).toHaveLength(2);
    expect(segs[0]!.sideLabel).toBe("left");
    expect(segs[1]!.sideLabel).toBe("right");
    expect(partDisplaySegmentsShouldSplit(segs)).toBe(true);
  });

  it("expands quantity 3 without side into L, M, R", () => {
    const k: Kneeler = {
      id: "k1",
      capacity: 3,
      hardware: [
        {
          partId: "foot",
          name: "Prayer Sole",
          quantity: 3,
          status: "installed",
          date: "2026-01-01",
        },
      ],
    };
    const segs = partDisplaySegmentsForPartOnKneeler(k, "Prayer Sole");
    expect(segs).toHaveLength(3);
    expect(segs.map((s) => s.sideLabel)).toEqual(["left", "middle", "right"]);
  });

  it("uses explicit side with asymmetric quantity", () => {
    const k: Kneeler = {
      id: "k1",
      capacity: 3,
      hardware: [
        {
          partId: "s",
          name: "Spacer",
          quantity: 2,
          status: "needed",
          side: "left",
        },
        {
          partId: "s",
          name: "Spacer",
          quantity: 1,
          status: "installed",
          side: "right",
        },
      ],
    };
    const segs = partDisplaySegmentsForPartOnKneeler(k, "Spacer");
    expect(segs).toHaveLength(2);
    expect(segs[0]!.weight).toBe(2);
    expect(segs[1]!.weight).toBe(1);
  });

  it("sortHardwareItemsForPartDisplay orders L, M, R", () => {
    const sorted = sortHardwareItemsForPartDisplay([
      { partId: "a", name: "X", quantity: 1, status: "unknown", side: "right" },
      { partId: "b", name: "X", quantity: 1, status: "unknown", side: "left" },
      { partId: "c", name: "X", quantity: 1, status: "unknown", side: "middle" },
    ]);
    expect(sorted.map((h) => h.side)).toEqual(["left", "middle", "right"]);
  });

  it("partDisplaySegmentsForPartOnKneeler returns [] for blank name, pillar, or missing part", () => {
    const kneeler: Kneeler = {
      id: "k1",
      capacity: 3,
      hardware: [{ partId: "p", name: "Prayer Sole", quantity: 3, status: "needed" }],
    };
    expect(partDisplaySegmentsForPartOnKneeler(kneeler, "")).toEqual([]);
    expect(partDisplaySegmentsForPartOnKneeler(kneeler, "  ")).toEqual([]);
    expect(partDisplaySegmentsForPartOnKneeler({ id: "p", type: "Pillar", capacity: 2 }, "Prayer Sole")).toEqual([]);
    expect(partDisplaySegmentsForPartOnKneeler(kneeler, "Other")).toEqual([]);
  });

  it("expands quantity 1 as a single weighted segment", () => {
    const k: Kneeler = {
      id: "k1",
      capacity: 1,
      hardware: [{ partId: "x", name: "Plate", quantity: 1, status: "installed" }],
    };
    const segs = partDisplaySegmentsForPartOnKneeler(k, "Plate");
    expect(segs).toEqual([{ status: "installed", weight: 1, sideLabel: undefined }]);
  });

  it("defaultPartFilter uses URL slug, exact name, or highest needed+upcoming count", () => {
    const sections: PewSection[] = [
      {
        id: "s",
        label: "S",
        type: "pews",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [
              {
                id: "a",
                capacity: 3,
                hardware: [
                  { partId: "1", name: "Alpha", quantity: 2, status: "needed" },
                  { partId: "2", name: "Beta", quantity: 5, status: "upcoming" },
                ],
              },
            ],
          },
        ],
      },
    ];
    const names = ["Alpha", "Beta"];
    expect(defaultPartFilter("beta", names, sections)).toBe("Beta");
    expect(defaultPartFilter("Alpha", names, sections)).toBe("Alpha");
    expect(defaultPartFilter(null, names, sections)).toBe("Beta");
    expect(defaultPartFilter(null, [], sections)).toBe("");
  });
});
