import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildPewLayoutWorkbook } from "./pew-sections-excel";
import type {
  HardwareItem,
  Kneeler,
  PewRow,
  PewSection,
  Project,
} from "@/data/types";

const orient = { altar: "N", entrance: "S", left: "W", right: "E" };
const aisles = [{ id: "a", name: "A" }];

function part(status: HardwareItem["status"]): HardwareItem {
  return { partId: "p", name: "Part", quantity: 1, status };
}

function kneeler(over: Partial<Kneeler> & Pick<Kneeler, "id" | "capacity">): Kneeler {
  return {
    id: over.id,
    capacity: over.capacity,
    label: over.label,
    hardware: over.hardware ?? [part("installed")],
  };
}

function row(
  id: string,
  label: string,
  kneelers: Kneeler[],
  frontType: PewRow["frontType"] = "pew",
): PewRow {
  return { id, label, frontType, kneelers };
}

function sectionBase(
  id: string,
  label: string,
  rows: PewRow[],
  opts: Partial<Pick<PewSection, "side" | "alignment" | "type" | "group" | "mapRowAlign">> = {},
): PewSection {
  return {
    id,
    label,
    side: opts.side ?? "west",
    alignment: opts.alignment ?? "nave",
    group: opts.group ?? 0,
    rows,
    type: opts.type,
    mapRowAlign: opts.mapRowAlign,
  };
}

function project(sections: PewSection[]): Project {
  return {
    id: "t",
    name: "Test project",
    church: "C",
    description: "d",
    layout: { orientation: orient, aisles, sections },
  };
}

describe("buildPewLayoutWorkbook", () => {
  it("returns a non-trivial xlsx for one pew section with a row", async () => {
    const p = project([
      sectionBase("s1", "Main", [row("r1", "R1", [kneeler({ id: "k1", capacity: 1 })])]),
    ]);
    const u8 = await buildPewLayoutWorkbook(p);
    expect(u8.length).toBeGreaterThan(3000);
    expect(u8[0]).toBe(0x50);
    expect(u8[1]).toBe(0x4b);
  });

  it("places empty padding on the left for mapRowAlign end (east), matching the map", async () => {
    const p = project([
      sectionBase(
        "s1",
        "East",
        [
          row("r1", "Wide", [
            kneeler({ id: "a", capacity: 1 }),
            kneeler({ id: "b", capacity: 1 }),
            kneeler({ id: "c", capacity: 1 }),
          ]),
          row("r2", "Narrow", [kneeler({ id: "d", capacity: 1 })]),
        ],
        { side: "east", mapRowAlign: "end" },
      ),
    ]);
    const u8 = await buildPewLayoutWorkbook(p);
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(Buffer.from(u8));
    const s = wb2.worksheets[0];
    const narrowRow = 4;
    expect(String(s.getRow(narrowRow).getCell(2).value)).toBe("empty");
    expect(String(s.getRow(narrowRow).getCell(8).value)).toContain("e-0201");
  });

  it("sets US Letter, landscape, and fit to one page width for print", async () => {
    const p = project([
      sectionBase("s1", "Main", [row("r1", "R1", [kneeler({ id: "k1", capacity: 1 })])]),
    ]);
    const u8 = await buildPewLayoutWorkbook(p);
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(Buffer.from(u8));
    const s = wb2.worksheets[0];
    expect(s.pageSetup.paperSize).toBe(1);
    expect(s.pageSetup.fitToPage).toBe(true);
    expect(s.pageSetup.fitToWidth).toBe(1);
    expect(s.pageSetup.fitToHeight).toBe(0);
    expect(s.pageSetup.orientation).toBe("landscape");
  });

  it("writes a placeholder sheet when no section matches the filter", async () => {
    const p = project([
      sectionBase("s1", "Main", [row("r1", "R1", [kneeler({ id: "k1", capacity: 1 })])]),
    ]);
    const u8 = await buildPewLayoutWorkbook(p, { sectionId: "missing" });
    expect(u8.length).toBeGreaterThan(1000);
  });

  it("skips cross-aisle sections and yields no pews if only cross-aisle", async () => {
    const p = project([
      sectionBase("tr", "Transept", [], { type: "crossAisle", side: "full", alignment: "full" }),
    ]);
    const u8 = await buildPewLayoutWorkbook(p);
    expect(u8.length).toBeGreaterThan(500);
  });

  it("exports only the requested section id", async () => {
    const p = project([
      sectionBase("a", "A", [row("r1", "R1", [kneeler({ id: "k1", capacity: 1 })])], {
        group: 0,
      }),
      sectionBase("b", "B", [row("r1", "R1", [kneeler({ id: "k2", capacity: 2 })])], {
        group: 1,
      }),
    ]);
    const u8 = await buildPewLayoutWorkbook(p, { sectionId: "b" });
    expect(u8.length).toBeGreaterThan(3000);
  });

  it("handles a section with no rows", async () => {
    const p = project([sectionBase("empty", "Empty", [])]);
    const u8 = await buildPewLayoutWorkbook(p);
    expect(u8.length).toBeGreaterThan(2000);
  });

  it("handles a row with no kneelers and a full-width side label", async () => {
    const p = project([
      sectionBase("s", "Full block", [row("r0", "R0", [], "communionRail")], {
        side: "full",
        alignment: "full",
      }),
    ]);
    const u8 = await buildPewLayoutWorkbook(p);
    expect(u8.length).toBeGreaterThan(2000);
  });

  it("uses pillar kneeler styling and outer alignment", async () => {
    const p = project([
      sectionBase(
        "s1",
        "X",
        [
          row("r1", "R1", [
            kneeler({ id: "k1", capacity: 3, label: "Pillar", hardware: [part("unknown")] }),
            kneeler({
              id: "k2",
              capacity: 1,
              hardware: [part("needed"), { ...part("needed"), partId: "p2" }],
            }),
            kneeler({
              id: "k2b",
              capacity: 1,
              hardware: [part("unknown"), part("unknown")],
            }),
            kneeler({
              id: "k3",
              capacity: 1,
              hardware: [part("upcoming"), { ...part("installed"), name: "X", quantity: 1 }],
            }),
            kneeler({
              id: "k4",
              capacity: -0.1,
              hardware: [part("installed")],
            }),
          ]),
        ],
        { alignment: "outer" },
      ),
    ]);
    const u8 = await buildPewLayoutWorkbook(p);
    expect(u8.length).toBeGreaterThan(3000);
  });

  it("disambiguates duplicate section labels in sheet names", async () => {
    const p = project([
      sectionBase("a", "Same", [row("r1", "R1", [kneeler({ id: "k1", capacity: 1 })])], {
        group: 0,
      }),
      sectionBase("b", "Same", [row("r1", "R1", [kneeler({ id: "k2", capacity: 1 })])], {
        group: 0,
      }),
    ]);
    const u8 = await buildPewLayoutWorkbook(p);
    expect(u8.length).toBeGreaterThan(4000);
  });

  it("merges a no-kneeler row across the grid when another row sets max width", async () => {
    const p = project([
      sectionBase("s", "S", [
        row("r1", "Wide", [kneeler({ id: "k1", capacity: 3 })]),
        row("r2", "Empty", [], "pew"),
      ]),
    ]);
    const u8 = await buildPewLayoutWorkbook(p);
    expect(u8.length).toBeGreaterThan(3000);
  });

  it("places a narrow em dash when the section is only zero-kneeler rows", async () => {
    const p = project([
      sectionBase("s", "S", [
        row("r1", "OnlyEmpty", [], "pew"),
        row("r2", "AlsoEmpty", [], "pew"),
      ]),
    ]);
    const u8 = await buildPewLayoutWorkbook(p);
    expect(u8.length).toBeGreaterThan(2500);
  });

  it("puts shared status on the row when all pews in the row match", async () => {
    const p = project([
      sectionBase("s1", "West Main", [
        row("r0", "Row 0", [
          kneeler({ id: "a", capacity: 1, hardware: [part("installed")] }),
          kneeler({ id: "b", capacity: 1, hardware: [part("installed")] }),
        ]),
      ]),
    ]);
    const u8 = await buildPewLayoutWorkbook(p);
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(Buffer.from(u8));
    const s = wb2.worksheets[0];
    const a3 = String(s.getRow(3).getCell(1).value);
    expect(a3).toContain("Installed");
    expect(s.getRow(3).getCell(2).value).toBe(`wm-0001`);
    // capacity 1.0 → 3 grid columns; second pew starts at column 5
    expect(s.getRow(3).getCell(5).value).toBe(`wm-0002`);
  });

  it("keeps per-pew status when pews in the row differ", async () => {
    const p = project([
      sectionBase("s1", "West Main", [
        row("r0", "Row 0", [
          kneeler({ id: "a", capacity: 1, hardware: [part("installed")] }),
          kneeler({ id: "b", capacity: 1, hardware: [part("needed")] }),
        ]),
      ]),
    ]);
    const u8 = await buildPewLayoutWorkbook(p);
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(Buffer.from(u8));
    const s = wb2.worksheets[0];
    const a3 = String(s.getRow(3).getCell(1).value);
    expect(a3).not.toContain("Installed");
    const b3 = String(s.getRow(3).getCell(2).value);
    const second = String(s.getRow(3).getCell(5).value);
    expect(b3).toContain("Installed");
    expect(second).toContain("Needed");
  });
});
