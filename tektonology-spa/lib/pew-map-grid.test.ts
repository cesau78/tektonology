import { describe, expect, it } from "vitest";
import type { PewSection } from "@/data/types";
import { collectGridRowNumbers, parseMapRowNumber } from "./pew-map-grid";

describe("pew-map-grid", () => {
  it("parseMapRowNumber reads Row N labels", () => {
    expect(
      parseMapRowNumber({
        id: "x",
        label: "Row 7",
        frontType: "pew",
        kneelers: [],
      }),
    ).toBe(7);
    expect(
      parseMapRowNumber({
        id: "x",
        label: "  Row 12 ",
        frontType: "pew",
        kneelers: [],
      }),
    ).toBe(12);
  });

  it("parseMapRowNumber uses mapRowNumber when set", () => {
    expect(
      parseMapRowNumber({
        id: "x",
        label: "Transept",
        mapRowNumber: 9,
        frontType: "pew",
        kneelers: [],
      }),
    ).toBe(9);
  });

  it("parseMapRowNumber returns null when label does not match Row N", () => {
    expect(
      parseMapRowNumber({
        id: "x",
        label: "Transept",
        frontType: "pew",
        kneelers: [],
      }),
    ).toBeNull();
  });

  it("parseMapRowNumber falls back to label when mapRowNumber is not finite", () => {
    expect(
      parseMapRowNumber({
        id: "x",
        label: "Row 4",
        mapRowNumber: Number.NaN,
        frontType: "pew",
        kneelers: [],
      }),
    ).toBe(4);
  });

  it("collectGridRowNumbers skips full-side and non-pew sections", () => {
    const sections: PewSection[] = [
      {
        id: "nave",
        label: "Nave",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [
          { id: "r1", label: "Row 1", frontType: "pew", kneelers: [] },
          { id: "rx", label: "No row number", frontType: "pew", kneelers: [] },
        ],
      },
      {
        id: "choir",
        label: "Choir",
        type: "pews",
        side: "full",
        alignment: "full",
        group: 0,
        rows: [{ id: "rx", label: "Row 99", frontType: "pew", kneelers: [] }],
      },
      {
        id: "skip",
        label: "X",
        type: "crossAisle",
        side: "west",
        alignment: "nave",
        group: 1,
        rows: [],
      },
    ];
    expect(collectGridRowNumbers(sections)).toEqual([1, 9]);
  });

  it("collectGridRowNumbers does not insert row 9 without a cross aisle", () => {
    const sections: PewSection[] = [
      {
        id: "w",
        label: "W",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [{ id: "r8", label: "Row 8", frontType: "pew", kneelers: [] }],
      },
    ];
    expect(collectGridRowNumbers(sections)).toEqual([8]);
  });

  it("collectGridRowNumbers merges sections and inserts transept row 9", () => {
    const sections: PewSection[] = [
      {
        id: "w",
        label: "W",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [
          { id: "r0", label: "Row 0", frontType: "pew", kneelers: [] },
          { id: "r8", label: "Row 8", frontType: "pew", kneelers: [] },
        ],
      },
      {
        id: "t",
        label: "Transept",
        type: "crossAisle",
        side: "full",
        alignment: "full",
        group: 1,
        rows: [],
      },
      {
        id: "wr",
        label: "WR",
        side: "west",
        alignment: "nave",
        group: 2,
        rows: [{ id: "r10", label: "Row 10", frontType: "pew", kneelers: [] }],
      },
    ];
    expect(collectGridRowNumbers(sections)).toEqual([0, 8, 9, 10]);
  });
});
