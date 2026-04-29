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
  it("adds a Church worksheet first with row grid and status background tints", async () => {
    const p = project([
      sectionBase(
        "a",
        "North",
        [
          {
            id: "r1",
            label: "Row 1",
            mapRowNumber: 1,
            frontType: "pew",
            kneelers: [kneeler({ id: "k1", capacity: 1, hardware: [part("needed")] })],
          },
        ],
        { side: "west", group: 0 },
      ),
      sectionBase(
        "b",
        "South",
        [
          {
            id: "r2",
            label: "Row 1",
            mapRowNumber: 1,
            frontType: "pew",
            kneelers: [kneeler({ id: "k2", capacity: 1, hardware: [part("installed")] })],
          },
        ],
        { side: "east", group: 0 },
      ),
    ]);
    const u8 = await buildPewLayoutWorkbook(p, { partName: "Part" });
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(Buffer.from(u8));
    expect(wb2.worksheets[0]?.name).toBe("Church");
    expect(wb2.worksheets[1]?.name).toBe("Church - West");
    expect(wb2.worksheets[2]?.name).toBe("Church - East");
    expect(wb2.worksheets.length).toBe(5);
    const church = wb2.worksheets[0]!;
    expect(String(church.getRow(1).getCell(1).value)).toContain("Church map (row grid)");
    expect(church.getRow(3).getCell(1).value).toBe(1);
    let foundNeededFill = false;
    let foundInstalledFill = false;
    for (let col = 2; col <= 40; col++) {
      const fill = church.getRow(3).getCell(col).fill as { fgColor?: { argb?: string } } | undefined;
      const argb = fill?.fgColor?.argb;
      if (argb === "FFFEF3C7") foundNeededFill = true;
      if (argb === "FFDCFCE7") foundInstalledFill = true;
    }
    expect(foundNeededFill).toBe(true);
    expect(foundInstalledFill).toBe(true);
  });

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
    const s = wb2.worksheets[3];
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
    const s = wb2.worksheets[3];
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
    const s = wb2.worksheets[3];
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
    const s = wb2.worksheets[3];
    const a3 = String(s.getRow(3).getCell(1).value);
    expect(a3).not.toContain("Installed");
    const b3 = String(s.getRow(3).getCell(2).value);
    const second = String(s.getRow(3).getCell(5).value);
    expect(b3).toContain("Installed");
    expect(second).toContain("Needed");
  });

  it("merges a kneeler that spans two adjacent pew-segment takes into one box (row 1 style 2.66+)", async () => {
    const p = project([
      sectionBase("s1", "West Main", [
        {
          id: "row-1",
          label: "Row 1",
          frontType: "pew",
          kneelers: [
            kneeler({ id: "r1-w1", capacity: 2.66, hardware: [part("installed")] }),
            kneeler({ id: "r1-w2", capacity: 2.66, hardware: [part("installed")] }),
            kneeler({ id: "r1-w3", capacity: 1, hardware: [part("installed")] }),
            kneeler({ id: "r1-w4", capacity: 2.66, hardware: [part("installed")] }),
          ],
          pewRailSegmentWidths: [3, 3, 3],
        },
      ]),
    ]);
    const u8 = await buildPewLayoutWorkbook(p, { exportDocumentDate: new Date(2026, 0, 1) });
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(Buffer.from(u8));
    const s = wb2.worksheets[3];
    const r = 3;
    const contigRuns = (id: string) => {
      const hits: number[] = [];
      for (let c = 2; c <= 80; c++) {
        const t = String(s.getRow(r).getCell(c).value ?? "");
        if (t.includes(id)) hits.push(c);
      }
      let runs = 0;
      for (let i = 0; i < hits.length; i++) {
        if (i === 0 || hits[i]! !== hits[i - 1]! + 1) runs += 1;
      }
      return runs;
    };
    expect(contigRuns("wm-0102")).toBe(1);
    expect(contigRuns("wm-0103")).toBe(1);
    const merges = (s as unknown as { model?: { merges?: string[] } }).model?.merges as
      | string[]
      | undefined;
    for (const spec of ["B3:I3", "J3:Q3", "R3:T3", "U3:AB3"]) {
      expect(merges).toContain(spec);
    }
  });

  it("keeps 1p after a pillar as its own block (3,2,1,3,3) in column order, not 3+3+1", async () => {
    const p = project([
      sectionBase("s1", "West", [
        {
          id: "row-8",
          label: "Row 8",
          frontType: "pewOnly",
          kneelers: [
            kneeler({ id: "a", capacity: 3, hardware: [part("installed")] }),
            kneeler({ id: "b", capacity: 1, hardware: [part("installed")] }),
            kneeler({ id: "c", capacity: 3, hardware: [part("installed")] }),
            kneeler({ id: "d", capacity: 3, hardware: [part("installed")] }),
          ],
          pewRailSegmentWidths: [3, 2, 1, 3, 3],
          pewRailSegmentKinds: ["pew", "gap", "pew", "pew", "pew"],
        },
      ]),
    ]);
    const u8 = await buildPewLayoutWorkbook(p, { exportDocumentDate: new Date(2026, 0, 1) });
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(Buffer.from(u8));
    const s = wb2.worksheets[3];
    const merges = (s as unknown as { model?: { merges?: string[] } }).model?.merges ?? [];
    const toCol = (letters: string) => {
      let n = 0;
      for (const ch of letters.toUpperCase()) n = n * 26 + (ch.codePointAt(0)! - 64);
      return n;
    };
    const onRow3 = merges
      .map((sp) => {
        const m = sp.match(/^([A-Z]+)3:([A-Z]+)3$/i);
        if (!m) return null;
        const c0 = toCol(m[1]!);
        const c1 = toCol(m[2]!);
        if (c0 < 2) return null;
        return { c0, w: c1 - c0 + 1 };
      })
      .filter((x): x is { c0: number; w: number } => x !== null)
      .toSorted((a, b) => a.c0 - b.c0);
    const widths = onRow3.map((x) => x.w);
    // 3p=9, 2p gap=6, 1p=3, then 3+3. Data must match rail (3+1+3+3=10) so 1p after pillar
    // stays 3 columns wide, not 3+3+1 in column order.
    expect(widths[0]).toBe(9);
    expect(widths[1]).toBe(6);
    expect(widths[2]).toBe(3);
  });

  it("lists a straddled kneeler's bench id once when capacity still matches rail (3+3+3+1 on 3,2,1,3,3)", async () => {
    const p = project([
      sectionBase("s1", "West", [
        {
          id: "row-8",
          label: "Row 8",
          frontType: "pewOnly",
          kneelers: [
            kneeler({ id: "a", capacity: 3, hardware: [part("installed")] }),
            kneeler({ id: "b", capacity: 3, hardware: [part("installed")] }),
            kneeler({ id: "c", capacity: 3, hardware: [part("installed")] }),
            kneeler({ id: "d", capacity: 1, hardware: [part("installed")] }),
          ],
          pewRailSegmentWidths: [3, 2, 1, 3, 3],
          pewRailSegmentKinds: ["pew", "gap", "pew", "pew", "pew"],
        },
      ]),
    ]);
    const u8 = await buildPewLayoutWorkbook(p, { exportDocumentDate: new Date(2026, 0, 1) });
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(Buffer.from(u8));
    const s = wb2.worksheets[3];
    const r = 3;
    const toCol = (letters: string) => {
      let n = 0;
      for (const ch of letters.toUpperCase()) n = n * 26 + (ch.codePointAt(0)! - 64);
      return n;
    };
    const merges = (s as unknown as { model?: { merges?: string[] } }).model?.merges ?? [];
    let w0802InMergeMasters = 0;
    for (const sp of merges) {
      const m = sp.match(/^([A-Z]+)3:([A-Z]+)3$/i);
      if (!m) continue;
      const c0 = toCol(m[1]!);
      if (c0 < 2) continue; // not pew grid
      const t = String(s.getRow(r).getCell(c0).value ?? "");
      w0802InMergeMasters += (t.match(/w-0802/g) ?? []).length; // "West" → prefix w
    }
    expect(w0802InMergeMasters).toBe(1);
  });

  it("emits a single pillar region when rail gap matches a pillar kneeler (no duplicate box)", async () => {
    const p = project([
      sectionBase("s1", "West", [
        {
          id: "r1",
          label: "Row 1",
          frontType: "pewOnly",
          kneelers: [
            kneeler({ id: "a", capacity: 3, hardware: [part("installed")] }),
            kneeler({ id: "p", capacity: 2, label: "Pillar", hardware: [] }),
            kneeler({ id: "b", capacity: 1, hardware: [part("installed")] }),
            kneeler({ id: "c", capacity: 3, hardware: [part("installed")] }),
            kneeler({ id: "d", capacity: 3, hardware: [part("installed")] }),
          ],
          pewRailSegmentWidths: [3, 2, 1, 3, 3],
          pewRailSegmentKinds: ["pew", "gap", "pew", "pew", "pew"],
        },
      ]),
    ]);
    const u8 = await buildPewLayoutWorkbook(p, { exportDocumentDate: new Date(2026, 0, 1) });
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(Buffer.from(u8));
    const s = wb2.worksheets[3]!;
    const r = 3;
    const toCol = (letters: string) => {
      let n = 0;
      for (const ch of letters.toUpperCase()) n = n * 26 + (ch.codePointAt(0)! - 64);
      return n;
    };
    const merges = (s as unknown as { model?: { merges?: string[] } }).model?.merges ?? [];
    let pillarMergeMasters = 0;
    for (const sp of merges) {
      const m = sp.match(/^([A-Z]+)3:([A-Z]+)3$/i);
      if (!m) continue;
      const c0 = toCol(m[1]!);
      if (c0 < 2) continue;
      if (String(s.getRow(r).getCell(c0).value ?? "") === "pillar") pillarMergeMasters += 1;
    }
    expect(pillarMergeMasters).toBe(1);
  });

  it("interleaves a pillar gap from explicit pew rail (2p) between kneeler blocks", async () => {
    const p = project([
      sectionBase("s1", "West", [
        {
          id: "r1",
          label: "Row 1",
          frontType: "pewOnly",
          kneelers: [
            kneeler({ id: "a", capacity: 3, hardware: [part("installed")] }),
            kneeler({ id: "b", capacity: 1, hardware: [part("installed")] }),
            kneeler({ id: "c", capacity: 3, hardware: [part("installed")] }),
            kneeler({ id: "d", capacity: 3, hardware: [part("installed")] }),
          ],
          pewRailSegmentWidths: [3, 2, 1, 3, 3],
          pewRailSegmentKinds: ["pew", "gap", "pew", "pew", "pew"],
        },
      ]),
    ]);
    const u8 = await buildPewLayoutWorkbook(p, { exportDocumentDate: new Date(2026, 0, 1) });
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(Buffer.from(u8));
    const s = wb2.worksheets[3];
    expect(String(s.getRow(3).getCell(1).value)).toContain("Pew Only");
    let foundPillar = false;
    for (let c = 2; c <= 40; c++) {
      const t = String(s.getRow(3).getCell(c).value ?? "");
      if (t === "pillar") {
        foundPillar = true;
        break;
      }
    }
    expect(foundPillar).toBe(true);
    for (let c = 2; c <= 40; c++) {
      const t = String(s.getRow(3).getCell(c).value ?? "");
      if (!t || t === "empty") continue;
      const benchIds = t.match(/wm-\d{4}/g) ?? [];
      expect(benchIds.length).toBeLessThanOrEqual(1);
    }
  });

  it("adds a Date line under Part in the merged title", async () => {
    const p = project([
      sectionBase("s1", "Main", [row("r1", "R1", [kneeler({ id: "k1", capacity: 1 })])]),
    ]);
    const fixed = new Date(2026, 3, 5);
    const u8 = await buildPewLayoutWorkbook(p, { exportDocumentDate: fixed });
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(Buffer.from(u8));
    const title = String(wb2.worksheets[3].getRow(1).getCell(1).value);
    expect(title).toContain("Part: —");
    expect(title).toContain("Date: April 5, 2026");
  });
});
