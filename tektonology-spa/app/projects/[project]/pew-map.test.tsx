import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { PewMap } from "./pew-map";
import type {
  PewSection,
  ChurchOrientation,
  Kneeler,
  HardwareItem,
  Project,
} from "@/data/types";
import * as navigation from "next/navigation";

afterEach(cleanup);

function makeHardware(overrides: Partial<HardwareItem> = {}): HardwareItem {
  return { partId: "foot", name: "Prayer Sole", quantity: 3, status: "needed", ...overrides };
}

function makeKneeler(overrides: Partial<Kneeler> = {}): Kneeler {
  return {
    id: "k1",
    capacity: 3,
    hardware: [makeHardware()],
    ...overrides,
  };
}

function makeSection(overrides: Partial<PewSection> = {}): PewSection {
  return {
    id: "sec-west",
    label: "West Section",
    type: "pews",
    side: "west",
    alignment: "nave",
    group: 0,
    rows: [
      {
        id: "row-1",
        label: "Row 1",
        frontType: "pew",
        kneelers: [makeKneeler()],
      },
    ],
    ...overrides,
  };
}

const orientation: ChurchOrientation = {
  altar: "N",
  entrance: "S",
  left: "W",
  right: "E",
};

const miniProject: Project = {
  id: "proj-export",
  name: "Test Project",
  church: "Test Church",
  description: "d",
  layout: {
    orientation,
    aisles: [],
    sections: [makeSection()],
  },
};

describe("PewMap", () => {
  it("shows wheelchair symbol when row.handicapAccessible", () => {
    const sections: PewSection[] = [
      makeSection({
        id: "eo",
        label: "East Outer",
        side: "eastOuter",
        group: 0,
        rows: [
          {
            id: "r9",
            label: "Row 9",
            handicapAccessible: true,
            frontType: "pewOnly",
            kneelers: [],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap
        churchName="T"
        orientation={orientation}
        sections={sections}
        partNames={["Prayer Sole"]}
      />,
    );
    expect(container.textContent).toContain("♿");
  });

  it("scales row widths in map when mapRowAlign is start or end", () => {
    const rowsNarrowWide = [
      {
        id: "r0",
        label: "R0",
        frontType: "communionRail" as const,
        kneelers: [makeKneeler({ id: "a", capacity: 3 })],
      },
      {
        id: "r1",
        label: "R1",
        frontType: "pew" as const,
        kneelers: [
          makeKneeler({ id: "b", capacity: 3 }),
          makeKneeler({ id: "c", capacity: 3 }),
          makeKneeler({ id: "d", capacity: 3 }),
          makeKneeler({ id: "e", capacity: 3 }),
        ],
      },
    ];
    const sections = [
      makeSection({
        id: "west-front",
        label: "West Front",
        side: "west",
        alignment: "outer",
        group: 0,
        mapRowAlign: "start",
        rows: rowsNarrowWide,
      }),
      makeSection({
        id: "east-front",
        label: "East Front",
        side: "east",
        alignment: "outer",
        group: 0,
        mapRowAlign: "end",
        rows: rowsNarrowWide,
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );
    expect(container.querySelectorAll(".items-start .min-w-0[style]").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".items-end .min-w-0[style]").length).toBeGreaterThan(0);
  });

  it("renders church name as title", () => {
    const { container } = render(
      <PewMap
        churchName="The Shrine Church of Saint Stanislaus"
        orientation={orientation}
        sections={[makeSection()]}
        partNames={["Prayer Sole"]}
      />,
    );
    expect(container).toHaveTextContent("The Shrine Church of Saint Stanislaus");
  });

  it("defaults to the part with the most needed+upcoming", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [
              makeKneeler({
                hardware: [
                  makeHardware({ name: "Prayer Sole", quantity: 2, status: "needed" }),
                  makeHardware({ name: "Kneeler Bushing", quantity: 5, status: "needed" }),
                  makeHardware({ name: "Kneeler Bushing", quantity: 3, status: "upcoming" }),
                ],
              }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole", "Kneeler Bushing"]} />,
    );

    const select = container.querySelector("select")!;
    expect(select.value).toBe("Kneeler Bushing");
  });

  it("renders summary filtered to selected part", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [
              makeKneeler({
                hardware: [
                  makeHardware({ name: "Prayer Sole", quantity: 3, status: "installed" }),
                  makeHardware({ name: "Prayer Sole", quantity: 2, status: "needed" }),
                  makeHardware({ name: "Kneeler Bushing", quantity: 4, status: "needed" }),
                ],
              }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Kneeler Bushing", "Prayer Sole"]} />,
    );

    // Default is Kneeler Bushing (most needed+upcoming = 4)
    expect(container).toHaveTextContent("0 / 4 resolved (0%)");

    // Switch to Prayer Sole
    const select = container.querySelector("select")!;
    fireEvent.change(select, { target: { value: "Prayer Sole" } });
    expect(container).toHaveTextContent("3 / 5 resolved (60%)");
  });

  it("updates summary when part filter is changed", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [
              makeKneeler({
                hardware: [
                  makeHardware({ name: "Prayer Sole", quantity: 3, status: "installed" }),
                  makeHardware({ name: "Kneeler Bushing", quantity: 2, status: "needed" }),
                ],
              }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Kneeler Bushing", "Prayer Sole"]} />,
    );

    const select = container.querySelector("select")!;
    fireEvent.change(select, { target: { value: "Prayer Sole" } });
    expect(container).toHaveTextContent("3 / 3 resolved (100%)");

    fireEvent.change(select, { target: { value: "Kneeler Bushing" } });
    expect(container).toHaveTextContent("0 / 2 resolved (0%)");
  });

  it("includes upcoming in summary total", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [
              makeKneeler({
                hardware: [
                  makeHardware({ name: "Foot", quantity: 3, status: "installed" }),
                  makeHardware({ name: "Foot", quantity: 2, status: "upcoming" }),
                  makeHardware({ name: "Foot", quantity: 1, status: "needed" }),
                ],
              }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Foot"]} />,
    );
    expect(container).toHaveTextContent("3 / 6 resolved (50%)");
  });

  it("shows 0% when no trackable parts exist for selected part", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [
              makeKneeler({
                hardware: [makeHardware({ name: "Prayer Sole", status: "unknown" })],
              }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );
    expect(container).toHaveTextContent("0 / 0 resolved (0%)");
  });

  it("renders Altar and Entrance labels without direction", () => {
    const { container } = render(
      <PewMap
        churchName="Test Church"
        orientation={orientation}
        sections={[makeSection()]}
        partNames={["Prayer Sole"]}
      />,
    );
    expect(container).toHaveTextContent("Altar");
    expect(container).toHaveTextContent("Entrance");
    expect(container).not.toHaveTextContent("Altar (North)");
    expect(container).not.toHaveTextContent("Entrance (South)");
  });

  it("renders compass rose with orientation letters", () => {
    const { container } = render(
      <PewMap
        churchName="Test Church"
        orientation={orientation}
        sections={[makeSection()]}
        partNames={["Prayer Sole"]}
      />,
    );
    expect(container).toHaveTextContent("N");
    expect(container).toHaveTextContent("S");
    expect(container).toHaveTextContent("W");
    expect(container).toHaveTextContent("E");
  });

  it("renders part filter dropdown without All Parts option", () => {
    const { container } = render(
      <PewMap
        churchName="Test Church"
        orientation={orientation}
        sections={[makeSection()]}
        partNames={["Prayer Sole", "Kneeler Bushing"]}
      />,
    );
    const select = container.querySelector("select")!;
    expect(select).toBeTruthy();
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toEqual(["Prayer Sole", "Kneeler Bushing"]);
    expect(options).not.toContain("All Parts");
  });

  it("renders layout export under the part selector when project is set", () => {
    render(
      <PewMap
        churchName="Test Church"
        orientation={orientation}
        sections={[makeSection()]}
        partNames={["Prayer Sole"]}
        project={miniProject}
        exportSectionId="sec-west"
      />,
    );
    expect(
      screen.getByRole("button", { name: /^export$/i }),
    ).toBeInTheDocument();
  });

  it("does not render layout export when the default part name is empty", () => {
    render(
      <PewMap
        churchName="Test Church"
        orientation={orientation}
        sections={[makeSection()]}
        partNames={[""]}
        project={miniProject}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /^export$/i }),
    ).not.toBeInTheDocument();
  });

  it("filters kneeler colors by selected part", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [
              makeKneeler({
                id: "k1",
                hardware: [
                  makeHardware({ name: "Prayer Sole", status: "installed" }),
                  makeHardware({ name: "Kneeler Bushing", status: "needed" }),
                ],
              }),
            ],
          },
        ],
      }),
    ];

    const { container } = render(
      <PewMap
        churchName="Test Church"
        orientation={orientation}
        sections={sections}
        partNames={["Kneeler Bushing", "Prayer Sole"]}
      />,
    );

    // Default is Kneeler Bushing (most needed+upcoming) — should show amber (needed)
    expect(container.querySelectorAll(".bg-amber-100").length).toBeGreaterThan(0);

    // Select "Prayer Sole" — should show green (installed)
    const select = container.querySelector("select")!;
    fireEvent.change(select, { target: { value: "Prayer Sole" } });
    expect(container.querySelectorAll(".bg-green-100").length).toBeGreaterThan(0);
  });

  it("shows none color for kneelers missing the selected part", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [
              makeKneeler({
                id: "k1",
                hardware: [makeHardware({ name: "Prayer Sole", status: "needed" })],
              }),
            ],
          },
        ],
      }),
    ];

    const { container } = render(
      <PewMap
        churchName="Test Church"
        orientation={orientation}
        sections={sections}
        partNames={["Kneeler Bushing", "Prayer Sole"]}
      />,
    );

    // Default is Prayer Sole (only part with needed+upcoming)
    // Switch to Kneeler Bushing — kneeler doesn't have this part
    const select = container.querySelector("select")!;
    fireEvent.change(select, { target: { value: "Kneeler Bushing" } });
    expect(container.querySelectorAll(".bg-neutral-100").length).toBeGreaterThan(0);
  });

  it("renders row-aligned table when pewMapUseRowGrid is set", () => {
    const sections: PewSection[] = [
      {
        id: "w",
        label: "West",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [{ id: "r8", label: "Row 8", frontType: "pew", kneelers: [makeKneeler({ id: "k1" })] }],
      },
      {
        id: "wr",
        label: "West rear",
        side: "west",
        alignment: "nave",
        group: 2,
        rows: [{ id: "r10", label: "Row 10", frontType: "pew", kneelers: [makeKneeler({ id: "kw" })] }],
      },
      {
        id: "e",
        label: "East",
        side: "east",
        alignment: "nave",
        group: 0,
        mapRowAlign: "end",
        rows: [{ id: "r8e", label: "Row 8", frontType: "pew", kneelers: [makeKneeler({ id: "k1" })] }],
      },
      {
        id: "er",
        label: "East rear",
        side: "east",
        alignment: "nave",
        group: 2,
        mapRowAlign: "end",
        rows: [{ id: "r10e", label: "Row 10", frontType: "pew", kneelers: [makeKneeler({ id: "ke" })] }],
      },
      {
        id: "wo",
        label: "WO",
        side: "westOuter",
        alignment: "nave",
        group: 0,
        mapRowAlign: "start",
        rows: [{ id: "r8wo", label: "Row 8", frontType: "pew", kneelers: [makeKneeler({ id: "k1" })] }],
      },
      {
        id: "eo",
        label: "EO",
        side: "eastOuter",
        alignment: "nave",
        group: 0,
        mapRowAlign: "end",
        rows: [{ id: "r8eo", label: "Row 8", frontType: "pew", kneelers: [makeKneeler({ id: "k1" })] }],
      },
      {
        id: "tr",
        label: "Transept",
        type: "crossAisle",
        side: "full",
        alignment: "full",
        group: 1,
        rows: [],
      },
    ];
    const { container } = render(
      <PewMap
        churchName="Grid Test"
        orientation={orientation}
        sections={sections}
        partNames={["Prayer Sole"]}
        projectSlug="grid-proj"
        pewMapUseRowGrid
      />,
    );
    expect(container.querySelector("table")).toBeTruthy();
    expect(container).toHaveTextContent("Transept");
    expect(container.querySelector('a[href="/projects/grid-proj/sections/wo/"]')).toBeTruthy();
  });

  it("churchGridRowDelta -1 shifts west outer pew down one grid row vs nave", () => {
    const sections: PewSection[] = [
      {
        id: "w",
        label: "West",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [
          { id: "r7", label: "Row 7", frontType: "pew", kneelers: [makeKneeler({ id: "w7" })] },
          { id: "r8", label: "Row 8", frontType: "pew", kneelers: [makeKneeler({ id: "w8" })] },
        ],
      },
      {
        id: "e",
        label: "East",
        side: "east",
        alignment: "nave",
        group: 0,
        rows: [
          { id: "r7e", label: "Row 7", frontType: "pew", kneelers: [makeKneeler({ id: "e7" })] },
          { id: "r8e", label: "Row 8", frontType: "pew", kneelers: [makeKneeler({ id: "e8" })] },
        ],
      },
      {
        id: "wo",
        label: "WO",
        side: "westOuter",
        alignment: "nave",
        group: 0,
        churchGridRowDelta: -1,
        rows: [{ id: "r7wo", label: "Row 7", frontType: "pew", kneelers: [makeKneeler({ id: "wo7" })] }],
      },
    ];
    const { container } = render(
      <PewMap
        churchName="Delta"
        orientation={orientation}
        sections={sections}
        partNames={["Prayer Sole"]}
        projectSlug="delta-proj"
        pewMapUseRowGrid
      />,
    );
    const trFor = (n: string) =>
      [...container.querySelectorAll("tbody tr")].find(
        (tr) => tr.querySelector("td")?.textContent?.trim() === n,
      );
    expect(trFor("7")?.querySelector('a[href="/projects/delta-proj/sections/wo/"]')).toBeFalsy();
    expect(trFor("8")?.querySelector('a[href="/projects/delta-proj/sections/wo/"]')).toBeTruthy();
  });

  it("row grid handles missing outer sections and one-sided rear rows", () => {
    const sections: PewSection[] = [
      {
        id: "w",
        label: "West",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [{ id: "r8", label: "Row 8", frontType: "pew", kneelers: [makeKneeler({ id: "a" })] }],
      },
      {
        id: "e",
        label: "East",
        side: "east",
        alignment: "nave",
        group: 0,
        mapRowAlign: "end",
        rows: [{ id: "r8e", label: "Row 8", frontType: "pew", kneelers: [makeKneeler({ id: "c" })] }],
      },
      {
        id: "er",
        label: "East rear",
        side: "east",
        alignment: "nave",
        group: 2,
        mapRowAlign: "end",
        rows: [{ id: "r10e", label: "Row 10", frontType: "pew", kneelers: [makeKneeler({ id: "d" })] }],
      },
      {
        id: "wo",
        label: "WO",
        side: "westOuter",
        alignment: "nave",
        group: 0,
        mapRowAlign: "start",
        rows: [{ id: "r8wo", label: "Row 8", frontType: "pew", kneelers: [makeKneeler({ id: "wo" })] }],
      },
      {
        id: "tr",
        label: "Transept",
        type: "crossAisle",
        side: "full",
        alignment: "full",
        group: 1,
        rows: [],
      },
    ];
    const { container } = render(
      <PewMap
        churchName="Grid Partial"
        orientation={orientation}
        sections={sections}
        partNames={["Prayer Sole"]}
        pewMapUseRowGrid
      />,
    );
    expect(container.querySelector("table")).toBeTruthy();
    expect(container).toHaveTextContent("Transept");
  });

  it("row grid falls back when there is no cross aisle and uses east-only alignment", () => {
    const sections: PewSection[] = [
      {
        id: "e",
        label: "East",
        side: "east",
        alignment: "outer",
        group: 0,
        mapRowAlign: "end",
        rows: [{ id: "r1", label: "Row 1", frontType: "pew", kneelers: [makeKneeler({ id: "k" })] }],
      },
      {
        id: "er",
        label: "East rear",
        side: "east",
        alignment: "outer",
        group: 2,
        mapRowAlign: "end",
        rows: [{ id: "r2", label: "Row 2", frontType: "pew", kneelers: [makeKneeler({ id: "k2" })] }],
      },
    ];
    const { container } = render(
      <PewMap
        churchName="East only"
        orientation={orientation}
        sections={sections}
        partNames={["Prayer Sole"]}
        pewMapUseRowGrid
      />,
    );
    expect(container.querySelector("table")).toBeTruthy();
    expect(container.innerHTML).toContain("min-w-[4rem]");
  });

  it("row grid leaves east center cell empty when no east section has that row", () => {
    const sections: PewSection[] = [
      {
        id: "w",
        label: "West",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [{ id: "r8", label: "Row 8", frontType: "pew", kneelers: [makeKneeler({ id: "a" })] }],
      },
      {
        id: "wr",
        label: "West rear",
        side: "west",
        alignment: "nave",
        group: 2,
        rows: [{ id: "r10", label: "Row 10", frontType: "pew", kneelers: [makeKneeler({ id: "b" })] }],
      },
      {
        id: "e",
        label: "East",
        side: "east",
        alignment: "nave",
        group: 0,
        mapRowAlign: "end",
        rows: [{ id: "r8e", label: "Row 8", frontType: "pew", kneelers: [makeKneeler({ id: "c" })] }],
      },
      {
        id: "tr",
        label: "Transept",
        type: "crossAisle",
        side: "full",
        alignment: "full",
        group: 1,
        rows: [],
      },
    ];
    const { container } = render(
      <PewMap
        churchName="Grid West10"
        orientation={orientation}
        sections={sections}
        partNames={["Prayer Sole"]}
        pewMapUseRowGrid
      />,
    );
    expect(container.querySelector("table")).toBeTruthy();
  });

  it("row grid handles empty section list", () => {
    const { container } = render(
      <PewMap
        churchName="Empty"
        orientation={orientation}
        sections={[]}
        partNames={[]}
        pewMapUseRowGrid
      />,
    );
    expect(container.querySelector("table")).toBeTruthy();
  });

  it("row grid uses wider nave column when west and east are outer-aligned", () => {
    const sections: PewSection[] = [
      {
        id: "w",
        label: "West",
        side: "west",
        alignment: "outer",
        group: 0,
        rows: [{ id: "r8", label: "Row 8", frontType: "pew", kneelers: [makeKneeler({ id: "k1" })] }],
      },
      {
        id: "e",
        label: "East",
        side: "east",
        alignment: "outer",
        group: 0,
        mapRowAlign: "end",
        rows: [{ id: "r8e", label: "Row 8", frontType: "pew", kneelers: [makeKneeler({ id: "k2" })] }],
      },
      {
        id: "wo",
        label: "WO",
        side: "westOuter",
        alignment: "nave",
        group: 0,
        mapRowAlign: "start",
        rows: [{ id: "r8wo", label: "Row 8", frontType: "pew", kneelers: [makeKneeler({ id: "k3" })] }],
      },
      {
        id: "eo",
        label: "EO",
        side: "eastOuter",
        alignment: "nave",
        group: 0,
        mapRowAlign: "end",
        rows: [{ id: "r8eo", label: "Row 8", frontType: "pew", kneelers: [makeKneeler({ id: "k4" })] }],
      },
      {
        id: "tr",
        label: "Transept",
        type: "crossAisle",
        side: "full",
        alignment: "full",
        group: 1,
        rows: [],
      },
    ];
    const { container } = render(
      <PewMap
        churchName="Grid Outer"
        orientation={orientation}
        sections={sections}
        partNames={["Prayer Sole"]}
        pewMapUseRowGrid
      />,
    );
    expect(container.innerHTML).toContain("min-w-[4rem]");
  });

  it("renders cross aisle (transept) across center and aisles only (outer spacers)", () => {
    const sections: PewSection[] = [
      { id: "transept", label: "Transept", type: "crossAisle", side: "full", alignment: "full", group: 0, rows: [] },
    ];

    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );
    expect(container).toHaveTextContent("Transept");
  });

  it("renders full-width pew section", () => {
    const sections = [makeSection({ id: "full-sec", label: "Full Section", side: "full", alignment: "full", group: 0 })];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );
    expect(container).toHaveTextContent("Full Section");
  });

  it("renders outer-aligned sections with center gap", () => {
    const sections = [
      makeSection({ id: "cw", label: "Comm West", side: "west", alignment: "outer", group: 0 }),
      makeSection({ id: "ce", label: "Comm East", side: "east", alignment: "outer", group: 0 }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );
    expect(container).toHaveTextContent("Comm West");
    expect(container).toHaveTextContent("Comm East");
  });

  it("renders outer sections (westOuter / eastOuter)", () => {
    const sections = [
      makeSection({ id: "wo", label: "West Outer", side: "westOuter", group: 0 }),
      makeSection({ id: "w", label: "West", side: "west", group: 0 }),
      makeSection({ id: "e", label: "East", side: "east", group: 0 }),
      makeSection({ id: "eo", label: "East Outer", side: "eastOuter", group: 0 }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );
    expect(container).toHaveTextContent("West Outer");
    expect(container).toHaveTextContent("East Outer");
  });

  it("falls back to nave alignment when group has only outer sections", () => {
    const sections = [
      makeSection({ id: "wo", label: "West Outer Only", side: "westOuter", group: 0 }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );
    expect(container).toHaveTextContent("West Outer Only");
  });

  it("renders rows without kneelers (pew bar only)", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [{ id: "r1", label: "Row 9", frontType: "pew", kneelers: [] }],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );
    expect(container).toHaveTextContent("0k");
  });

  it("skips kneeler segment styling for pillar column", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [
              makeKneeler({ id: "k1" }),
              { id: "pillar", capacity: 2, label: "Pillar", hardware: [] },
              makeKneeler({ id: "k2" }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );
    expect(container.querySelectorAll('div.h-2.w-full.min-w-0.border.rounded-sm').length).toBe(3);
  });

  it("treats type Pillar column like legacy label Pillar on the map", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [
              makeKneeler({ id: "k1" }),
              { id: "col-p", type: "Pillar", capacity: 2 },
              makeKneeler({ id: "k2" }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );
    expect(container.querySelector('[title="Pillar (gap)"]')).toBeTruthy();
    expect(container.querySelector(".rounded-sm.bg-neutral-300")).toBeTruthy();
  });

  it("renders bench gap with compact spanning pillar label on continuation row", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "row-9",
            label: "Row 9",
            frontType: "pew",
            kneelers: [
              makeKneeler({ id: "k1" }),
              { id: "pillar", capacity: 2, label: "Pillar", hardware: [] },
              makeKneeler({ id: "k2" }),
            ],
          },
          {
            id: "row-10",
            label: "Row 10",
            frontType: "pew",
            kneelers: [],
            pillarBenchContinuation: { fromRowId: "row-9", alignKneelerId: "pillar" },
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );
    expect(container.querySelector(".rounded-sm.bg-neutral-300")).toBeTruthy();
  });

  it("places pillar in rail and kneeler grid rows like pew columns when explicit rail matches kneelers", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            pewRailSegmentWidths: [3, 2, 3],
            pewRailSegmentKinds: ["pew", "gap", "pew"],
            kneelers: [
              makeKneeler({ id: "k1", capacity: 3 }),
              { id: "pillar", capacity: 2, label: "Pillar", hardware: [] },
              makeKneeler({ id: "k2", capacity: 3 }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );
    expect(container.querySelector('[style*="1 / 3"]')).toBeNull();
    const pillarCells = container.querySelectorAll('[title="Pillar (gap)"]');
    expect(pillarCells.length).toBe(1);
  });

  it("uses rounded-sm bench wrap when continuation row has no kneelers and previous row has no kneelers", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [
          { id: "row-9", label: "Row 9", frontType: "pew", kneelers: [] },
          {
            id: "row-10",
            label: "Row 10",
            frontType: "pew",
            kneelers: [],
            pillarBenchContinuation: { fromRowId: "row-9", alignKneelerId: "x" },
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );
    expect(container.querySelector(".rounded-sm.overflow-hidden")).toBeTruthy();
  });

  it("uses simple pew rail bar when row has kneelers but no pillar segments", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [makeKneeler()],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );
    expect(container.querySelector("div.grid")).toBeTruthy();
    expect(container.querySelector(".h-\\[5px\\].rounded-sm")).toBeTruthy();
  });

  it("wraps section tiles in Link when projectSlug is set", () => {
    const { container } = render(
      <PewMap
        churchName="Test"
        orientation={orientation}
        sections={[makeSection({ id: "west-main", label: "West" })]}
        partNames={["Prayer Sole"]}
        projectSlug="saint-stanislaus"
      />,
    );
    expect(
      container.querySelector('a[href="/projects/saint-stanislaus/sections/west-main/"]'),
    ).toBeTruthy();
  });

  it("omits pew rail strip when showRails is false", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [makeKneeler()],
          },
        ],
      }),
    ];
    const { container: full } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );
    const { container: kneel } = render(
      <PewMap
        churchName="Test"
        orientation={orientation}
        sections={sections}
        partNames={["Prayer Sole"]}
        showRails={false}
      />,
    );
    const fullBars = full.querySelectorAll(".bg-\\[\\#d4b896\\]");
    const kneelBars = kneel.querySelectorAll(".bg-\\[\\#d4b896\\]");
    expect(fullBars.length).toBeGreaterThan(0);
    // Row strips omit pew bench color when rails are hidden; legend still has one "Pew Only" swatch.
    expect(kneelBars.length).toBe(1);
  });

  it("renders transparent row spacer when showRails is false and row has no kneelers", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [],
            pillarBenchContinuation: { fromRowId: "r0", alignKneelerId: "pillar" },
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap
        churchName="Test"
        orientation={orientation}
        sections={sections}
        partNames={["Prayer Sole"]}
        showRails={false}
      />,
    );
    expect(container.querySelector('[aria-hidden="true"].bg-transparent.h-2')).toBeTruthy();
  });

  it("renders section stats (rows, kneelers, pct)", () => {
    const { container } = render(
      <PewMap
        churchName="Test"
        orientation={orientation}
        sections={[makeSection()]}
        partNames={["Prayer Sole"]}
      />,
    );
    expect(container).toHaveTextContent("1r");
    expect(container).toHaveTextContent("1k");
    expect(container).toHaveTextContent("0%");
  });

  it("renders aisle labels only on the first group", () => {
    const sections = [
      makeSection({ id: "w0", label: "W0", side: "west", group: 0 }),
      makeSection({ id: "e0", label: "E0", side: "east", group: 0 }),
      makeSection({ id: "w1", label: "W1", side: "west", group: 1 }),
      makeSection({ id: "e1", label: "E1", side: "east", group: 1 }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );
    expect(container).toHaveTextContent("W");
    expect(container).toHaveTextContent("E");
  });

  it("shows section with all hardware installed at 100%", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [
              makeKneeler({
                hardware: [makeHardware({ status: "installed" })],
              }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );
    expect(container).toHaveTextContent("100%");
  });

  it("renders kneeler as needed when all hardware needed for selected part", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [
              makeKneeler({
                hardware: [makeHardware({ status: "needed" })],
              }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );
    expect(container.querySelectorAll(".bg-amber-100").length).toBeGreaterThan(0);
  });

  it("shows none color for kneeler with empty hardware", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [makeKneeler({ hardware: [] })],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );
    expect(container.querySelectorAll(".bg-neutral-100").length).toBeGreaterThan(0);
  });

  it("falls back to default when URL param does not match any part name", () => {
    vi.spyOn(navigation, "useSearchParams").mockReturnValue(
      new URLSearchParams("part=nonexistent-part") as ReturnType<typeof navigation.useSearchParams>,
    );

    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [
              makeKneeler({
                hardware: [
                  makeHardware({ name: "Prayer Sole", quantity: 3, status: "needed" }),
                ],
              }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} />,
    );

    const select = container.querySelector("select")!;
    expect(select.value).toBe("Prayer Sole");

    vi.restoreAllMocks();
  });

  it("handles empty partNames array", () => {
    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [makeKneeler({ hardware: [] })],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={[]} />,
    );

    expect(container).toHaveTextContent("Test");
    const select = container.querySelector("select")!;
    expect(select.querySelectorAll("option")).toHaveLength(0);
  });

  it("initializes filter from URL search params", () => {
    vi.spyOn(navigation, "useSearchParams").mockReturnValue(
      new URLSearchParams("part=prayer-sole") as ReturnType<typeof navigation.useSearchParams>,
    );

    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [
              makeKneeler({
                hardware: [
                  makeHardware({ name: "Prayer Sole", quantity: 3, status: "installed" }),
                  makeHardware({ name: "Kneeler Bushing", quantity: 2, status: "needed" }),
                ],
              }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Kneeler Bushing", "Prayer Sole"]} />,
    );

    // URL param overrides default (Kneeler Bushing would be default by count)
    expect(container).toHaveTextContent("3 / 3 resolved (100%)");
    const select = container.querySelector("select")!;
    expect(select.value).toBe("Prayer Sole");

    vi.restoreAllMocks();
  });

  it("column grid shows pew rail bar in upper band when rails are on and segment is pew", () => {
    const sections: PewSection[] = [
      makeSection({
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [makeKneeler({ id: "a" }), makeKneeler({ id: "b" })],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="T" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} showRails />,
    );
    expect(container.innerHTML).toContain("d4b896");
  });

  it("shows rail-height pillar label in column grid when rails are on and segment is a gap", () => {
    const sections: PewSection[] = [
      makeSection({
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            pewRailSegmentWidths: [3, 2, 3],
            pewRailSegmentKinds: ["pew", "gap", "pew"],
            kneelers: [
              makeKneeler({ id: "a" }),
              { id: "p", type: "Pillar" as const, capacity: 2 },
              makeKneeler({ id: "b" }),
            ],
          },
        ],
      }),
    ];
    render(
      <PewMap churchName="T" orientation={orientation} sections={sections} partNames={["Prayer Sole"]} showRails />,
    );
    expect(screen.getAllByTitle("Pillar").length).toBeGreaterThan(0);
  });

  it("renders pillar rail spacer in column grid when rails are off but layout has a gap", () => {
    const sections: PewSection[] = [
      makeSection({
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            pewRailSegmentWidths: [3, 2, 3],
            pewRailSegmentKinds: ["pew", "gap", "pew"],
            kneelers: [
              makeKneeler({ id: "a" }),
              { id: "p", type: "Pillar" as const, capacity: 2 },
              makeKneeler({ id: "b" }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap
        churchName="T"
        orientation={orientation}
        sections={sections}
        partNames={["Prayer Sole"]}
        showRails={false}
      />,
    );
    expect(container.querySelector('[title="Pillar (gap)"]')).toBeTruthy();
  });

  it("renders pillar gap markers when rails are hidden and a rail-only row has a gap segment", () => {
    const sections: PewSection[] = [
      makeSection({
        rows: [
          {
            id: "r-gap",
            label: "Row 9",
            frontType: "pew",
            kneelers: [],
            pewRailSegmentWidths: [3, 2, 3],
            pewRailSegmentKinds: ["pew", "gap", "pew"],
          },
        ],
      }),
    ];
    render(
      <PewMap
        churchName="T"
        orientation={orientation}
        sections={sections}
        partNames={["Prayer Sole"]}
        showRails={false}
      />,
    );
    expect(screen.getAllByTitle("Pillar").length).toBeGreaterThan(0);
  });

  it("updates part filter when useSearchParams returns a new part after rerender", async () => {
    const spRef = { current: new URLSearchParams("") };
    vi.spyOn(navigation, "useSearchParams").mockImplementation(
      () => spRef.current as ReturnType<typeof navigation.useSearchParams>,
    );

    const sections = [
      makeSection({
        id: "s1",
        rows: [
          {
            id: "r1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [
              makeKneeler({
                hardware: [
                  makeHardware({ name: "Kneeler Bushing", quantity: 10, status: "needed" }),
                  makeHardware({ name: "Prayer Sole", quantity: 3, status: "needed" }),
                ],
              }),
            ],
          },
        ],
      }),
    ];
    const props = {
      churchName: "Test",
      orientation,
      sections,
      partNames: ["Kneeler Bushing", "Prayer Sole"],
    };
    const { container, rerender } = render(<PewMap {...props} />);
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe("Kneeler Bushing");

    spRef.current = new URLSearchParams("part=prayer-sole");
    rerender(<PewMap {...props} />);

    await waitFor(() => {
      expect((container.querySelector("select") as HTMLSelectElement).value).toBe("Prayer Sole");
    });

    vi.restoreAllMocks();
  });
});
