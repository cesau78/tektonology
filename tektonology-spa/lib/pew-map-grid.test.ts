import { describe, expect, it } from "vitest";
import type { PewSection } from "@/data/types";
import {
  churchGridRowMajorSectionOrder,
  collectGridRowNumbers,
  parseMapRowNumber,
} from "./pew-map-grid";

describe("pew-map-grid", () => {
  it("churchGridRowMajorSectionOrder sorts west then east blocks by group with outers on the sides", () => {
    const sections: PewSection[] = [
      { id: "em-g1", label: "E", type: "pews", side: "east", alignment: "nave", group: 1, rows: [] },
      { id: "eo", label: "EO", side: "eastOuter", alignment: "nave", group: 0, rows: [] },
      { id: "wo", label: "WO", side: "westOuter", alignment: "nave", group: 0, rows: [] },
      { id: "wm", label: "WM", type: "pews", side: "west", alignment: "nave", group: 0, rows: [] },
      { id: "wr", label: "WR", type: "pews", side: "west", alignment: "nave", group: 2, rows: [] },
      { id: "em-g0", label: "EM", type: "pews", side: "east", alignment: "nave", group: 0, rows: [] },
      { id: "east-no-type", label: "X", side: "east", alignment: "nave", group: 0, rows: [] },
    ];
    expect(churchGridRowMajorSectionOrder(sections).map((s) => s.id)).toEqual([
      "wo",
      "wm",
      "wr",
      "em-g0",
      "east-no-type",
      "em-g1",
      "eo",
    ]);
  });

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

  it("collectGridRowNumbers uses custom transept row when nave includes row 9", () => {
    const sections: PewSection[] = [
      {
        id: "w",
        label: "W",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [
          { id: "r8", label: "Row 8", frontType: "pew", kneelers: [] },
          { id: "r9", label: "Row 9", frontType: "pewOnly", kneelers: [] },
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
        rows: [{ id: "r11", label: "Row 11", frontType: "pew", kneelers: [] }],
      },
    ];
    expect(collectGridRowNumbers(sections, 10)).toEqual([8, 9, 10, 11]);
  });
});
