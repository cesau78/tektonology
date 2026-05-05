import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { Project, PewSection, Kneeler, HardwareItem } from "@/data/types";
import { kneelerHardware } from "@/lib/pew-layout";

const mockReaddirSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockNotFound = vi.fn();

vi.mock("fs", () => {
  const readFileSync = (...args: unknown[]) => mockReadFileSync(...args);
  const readdirSync = (...args: unknown[]) => mockReaddirSync(...args);
  return {
    readFileSync,
    readdirSync,
    default: { readFileSync, readdirSync },
  };
});

vi.mock("next/navigation", () => ({
  notFound: (...args: unknown[]) => mockNotFound(...args),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("./pew-map", () => ({
  PewMap: ({
    churchName,
    partNames,
    showRails,
    projectSlug,
  }: {
    churchName: string;
    partNames: string[];
    showRails?: boolean;
    projectSlug?: string;
  }) => (
    <div
      data-testid="pew-map"
      data-church={churchName}
      data-parts={partNames.join(",")}
      data-show-rails={String(showRails ?? true)}
      data-project-slug={projectSlug ?? ""}
    />
  ),
}));

vi.mock("./inventory-updates-card", () => ({
  InventoryUpdatesCard: ({
    updatesData,
    partNames,
  }: {
    updatesData: Record<string, unknown[]>;
    partNames: string[];
  }) => (
    <div
      data-testid="inventory-updates"
      data-parts={partNames.join(",")}
      data-updates={JSON.stringify(updatesData)}
    />
  ),
}));

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

function partNamesForSection(section: PewSection): string[] {
  return Array.from(
    new Set(section.rows.flatMap((r) => r.kneelers).flatMap((k) => kneelerHardware(k)).map((h) => h.name)),
  ).sort();
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "test-project",
    name: "Test Project",
    church: "Test Church",
    description: "A test project",
    layout: {
      orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
      aisles: [{ id: "nave", name: "Nave" }],
      sections: [
        makeSection({ id: "sec-west", label: "West", side: "west", group: 0 }),
        makeSection({ id: "sec-east", label: "East", side: "east", group: 0 }),
      ],
    },
    ...overrides,
  };
}

describe("ProjectDetailPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.resetModules();
    mockReaddirSync.mockReset();
    mockReadFileSync.mockReset();
    mockNotFound.mockReset();
  });

  it("renders project heading and description", async () => {
    const project = makeProject();
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    expect(container.querySelector("h1")).toHaveTextContent("Test Project");
    expect(container).toHaveTextContent("Test Church");
    expect(container).toHaveTextContent("A test project");
  });

  it("renders back link to projects", async () => {
    const project = makeProject();
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    const link = container.querySelector('a[href="/projects"]');
    expect(link).toBeTruthy();
  });

  it("calls notFound for missing project", async () => {
    mockReadFileSync.mockImplementation(() => { throw new Error("ENOENT"); });
    mockReaddirSync.mockReturnValue([]);
    mockNotFound.mockImplementation(() => { throw new Error("NEXT_NOT_FOUND"); });

    const { default: Page } = await import("./page");
    await expect(Page({ params: Promise.resolve({ project: "missing" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("passes church name and part names to PewMap", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
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
                      makeHardware({ name: "Collar" }),
                      makeHardware({ name: "Prayer Sole" }),
                    ],
                  }),
                ],
              },
            ],
          }),
        ],
      },
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    const pewMap = container.querySelector("[data-testid='pew-map']")!;
    expect(pewMap.getAttribute("data-church")).toBe("Test Church");
    expect(pewMap.getAttribute("data-parts")).toBe("Collar,Prayer Sole");
    expect(pewMap.getAttribute("data-show-rails")).toBe("false");
    expect(pewMap.getAttribute("data-project-slug")).toBe("test-project");
  });

  it("renders PewMap (status legend is inside the map card)", async () => {
    const project = makeProject();
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    expect(container.querySelector("[data-testid='pew-map']")).toBeTruthy();
  });

  it("renders pew map when layout includes crossAisle section", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          makeSection({ id: "pew-sec", label: "Pew Section" }),
          { id: "transept", label: "Transept", type: "crossAisle", side: "full", alignment: "full", group: 1, rows: [] },
        ],
      },
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    expect(container.querySelector("[data-testid='pew-map']")).toBeTruthy();
  });

  it("renders row with frontType labels", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          makeSection({
            id: "s1",
            label: "Section",
            rows: [
              { id: "r1", label: "Row 1", frontType: "communionRail", kneelers: [makeKneeler()] },
              { id: "r2", label: "Row 2", frontType: "pew", kneelers: [makeKneeler()] },
            ],
          }),
        ],
      },
    });
    const { SectionRowsPanel } = await import("./section-rows-panel");
    const { container } = render(<SectionRowsPanel
      section={project.layout.sections[0]}
      partNames={partNamesForSection(project.layout.sections[0])}
    />);

    expect(container).toHaveTextContent("Communion Rail");
    expect(container).toHaveTextContent("Pew with Kneeler");
  });

  it("renders rows without kneelers", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          makeSection({
            id: "s1",
            label: "Section",
            rows: [{ id: "r1", label: "Row 9", frontType: "pew", kneelers: [] }],
          }),
        ],
      },
    });
    const { SectionRowsPanel } = await import("./section-rows-panel");
    const { container } = render(<SectionRowsPanel
      section={project.layout.sections[0]}
      partNames={partNamesForSection(project.layout.sections[0])}
    />);

    expect(container).toHaveTextContent("Row 9");
    expect(container).toHaveTextContent("0 kneelers");
  });

  it("renders kneeler hardware status badges", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
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
                      makeHardware({ name: "Collar", quantity: 2, status: "upcoming" }),
                      makeHardware({ name: "Spacer", quantity: 2, status: "needed" }),
                    ],
                  }),
                ],
              },
            ],
          }),
        ],
      },
    });
    const { SectionRowsPanel } = await import("./section-rows-panel");
    const { container } = render(<SectionRowsPanel
      section={project.layout.sections[0]}
      partNames={partNamesForSection(project.layout.sections[0])}
    />);

    expect(container).toHaveTextContent("Installed");
    expect(container).toHaveTextContent("Upcoming");
    expect(container).toHaveTextContent("Needed");
  });

  it("computes kneeler status as installed when all hardware installed", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
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
                      makeHardware({ status: "installed" }),
                      makeHardware({ status: "installed" }),
                    ],
                  }),
                ],
              },
            ],
          }),
        ],
      },
    });
    const { SectionRowsPanel } = await import("./section-rows-panel");
    const { container } = render(<SectionRowsPanel
      section={project.layout.sections[0]}
      partNames={partNamesForSection(project.layout.sections[0])}
    />);

    const segments = container.querySelectorAll(".bg-green-100");
    expect(segments.length).toBeGreaterThan(0);
  });

  it("computes kneeler status as upcoming when some are upcoming or installed", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
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
                      makeHardware({ status: "upcoming" }),
                      makeHardware({ status: "needed" }),
                    ],
                  }),
                ],
              },
            ],
          }),
        ],
      },
    });
    const { SectionRowsPanel } = await import("./section-rows-panel");
    const { container } = render(<SectionRowsPanel
      section={project.layout.sections[0]}
      partNames={partNamesForSection(project.layout.sections[0])}
    />);

    const segments = container.querySelectorAll(".bg-blue-100");
    expect(segments.length).toBeGreaterThan(0);
  });

  it("computes kneeler status as unknown when all hardware is unknown", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          makeSection({
            id: "s1",
            rows: [
              {
                id: "r1",
                label: "Row 1",
                frontType: "pew",
                kneelers: [
                  makeKneeler({
                    hardware: [makeHardware({ status: "unknown" })],
                  }),
                ],
              },
            ],
          }),
        ],
      },
    });
    const { SectionRowsPanel } = await import("./section-rows-panel");
    const { container } = render(<SectionRowsPanel
      section={project.layout.sections[0]}
      partNames={partNamesForSection(project.layout.sections[0])}
    />);

    const segments = container.querySelectorAll(".bg-neutral-200");
    expect(segments.length).toBeGreaterThan(0);
  });

  it("renders parts inventory table", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
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
                      makeHardware({ name: "Collar", quantity: 2, status: "upcoming" }),
                      makeHardware({ name: "Spacer", quantity: 1, status: "installed" }),
                    ],
                  }),
                ],
              },
            ],
          }),
        ],
      },
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    expect(container).toHaveTextContent("Parts Inventory");
    expect(container).toHaveTextContent("Prayer Sole");
    expect(container).toHaveTextContent("Collar");
    expect(container).toHaveTextContent("Spacer");
  });

  it("splits kneeler plates by left and right in parts inventory", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
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
                      {
                        partId: "kneeler-pew-plate",
                        name: "Kneeler Plate",
                        quantity: 1,
                        status: "needed",
                        side: "left",
                      },
                      {
                        partId: "kneeler-pew-plate",
                        name: "Kneeler Plate",
                        quantity: 1,
                        status: "inspected",
                        side: "right",
                      },
                      {
                        partId: "kneeler-pew-plate",
                        name: "Kneeler Plate",
                        quantity: 1,
                        status: "installed",
                        side: "middle",
                      },
                    ],
                  }),
                ],
              },
            ],
          }),
        ],
      },
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    expect(container).toHaveTextContent("Kneeler Plate (Left)");
    expect(container).toHaveTextContent("Kneeler Plate (Right)");
    expect(container).toHaveTextContent("Kneeler Plate (Middle)");
    const leftRow = Array.from(container.querySelectorAll("tbody tr")).find((tr) =>
      tr.textContent?.includes("Kneeler Plate (Left)"),
    );
    const rightRow = Array.from(container.querySelectorAll("tbody tr")).find((tr) =>
      tr.textContent?.includes("Kneeler Plate (Right)"),
    );
    const middleRow = Array.from(container.querySelectorAll("tbody tr")).find((tr) =>
      tr.textContent?.includes("Kneeler Plate (Middle)"),
    );
    expect(leftRow).toBeTruthy();
    expect(rightRow).toBeTruthy();
    expect(middleRow).toBeTruthy();
    const leftCells = leftRow!.querySelectorAll("td");
    const rightCells = rightRow!.querySelectorAll("td");
    expect(leftCells[1].textContent).toBe("1");
    expect(leftCells[3].textContent).toBe("1");
    expect(rightCells[1].textContent).toBe("1");
    expect(rightCells[2].textContent).toBe("1");
  });

  it("renders kneeler label fallback when no label set", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          makeSection({
            id: "s1",
            rows: [
              {
                id: "r1",
                label: "Row 1",
                frontType: "pew",
                kneelers: [makeKneeler({ id: "k1", label: undefined })],
              },
            ],
          }),
        ],
      },
    });
    const { SectionRowsPanel } = await import("./section-rows-panel");
    const { container } = render(<SectionRowsPanel
      section={project.layout.sections[0]}
      partNames={partNamesForSection(project.layout.sections[0])}
    />);

    expect(container).toHaveTextContent("ws-0101");
  });

  it("renders kneeler with explicit label", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          makeSection({
            id: "s1",
            rows: [
              {
                id: "r1",
                label: "Row 1",
                frontType: "pew",
                kneelers: [makeKneeler({ id: "k1", label: "Custom Label" })],
              },
            ],
          }),
        ],
      },
    });
    const { SectionRowsPanel } = await import("./section-rows-panel");
    const { container } = render(<SectionRowsPanel
      section={project.layout.sections[0]}
      partNames={partNamesForSection(project.layout.sections[0])}
    />);

    expect(container).toHaveTextContent("ws-0101");
  });

  it("renders date in separate column when date is set", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          makeSection({
            id: "s1",
            rows: [
              {
                id: "r1",
                label: "Row 1",
                frontType: "pew",
                kneelers: [
                  makeKneeler({
                    hardware: [makeHardware({ status: "installed", date: "2026-03-15" })],
                  }),
                ],
              },
            ],
          }),
        ],
      },
    });
    const { SectionRowsPanel } = await import("./section-rows-panel");
    const { container } = render(<SectionRowsPanel
      section={project.layout.sections[0]}
      partNames={partNamesForSection(project.layout.sections[0])}
    />);

    expect(container).toHaveTextContent("Installed");
    expect(container.textContent).toMatch(/Installed:.*3/);
  });

  it("applies mapRowAlign start width scaling to section detail rows", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          makeSection({
            id: "s1",
            label: "West Front",
            side: "west",
            alignment: "outer",
            mapRowAlign: "start",
            rows: [
              { id: "r0", label: "Row 0", frontType: "communionRail", kneelers: [makeKneeler({ id: "k0", capacity: 3 })] },
              {
                id: "r1",
                label: "Row 1",
                frontType: "pew",
                kneelers: [makeKneeler({ id: "k1", capacity: 3 }), makeKneeler({ id: "k2", capacity: 3 })],
              },
            ],
          }),
        ],
      },
    });
    const { SectionRowsPanel } = await import("./section-rows-panel");
    const { container } = render(<SectionRowsPanel
      section={project.layout.sections[0]}
      partNames={partNamesForSection(project.layout.sections[0])}
    />);

    expect(container.querySelectorAll(".items-start .min-w-0[style]").length).toBeGreaterThan(0);
  });

  it("applies mapRowAlign end to section detail rows", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          makeSection({
            id: "s1",
            label: "East Front",
            side: "east",
            alignment: "outer",
            mapRowAlign: "end",
            rows: [
              { id: "r0", label: "Row 0", frontType: "communionRail", kneelers: [makeKneeler({ id: "k0", capacity: 3 })] },
              {
                id: "r1",
                label: "Row 1",
                frontType: "pew",
                kneelers: [makeKneeler({ id: "k1", capacity: 3 }), makeKneeler({ id: "k2", capacity: 3 })],
              },
            ],
          }),
        ],
      },
    });
    const { SectionRowsPanel } = await import("./section-rows-panel");
    const { container } = render(<SectionRowsPanel
      section={project.layout.sections[0]}
      partNames={partNamesForSection(project.layout.sections[0])}
    />);

    expect(container.querySelector(".items-end")).toBeTruthy();
  });

  it("shows message when kneeler has no hardware rows", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
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
        ],
      },
    });
    const { SectionRowsPanel } = await import("./section-rows-panel");
    const { container } = render(<SectionRowsPanel
      section={project.layout.sections[0]}
      partNames={partNamesForSection(project.layout.sections[0])}
    />);

    expect(container).toHaveTextContent("Unknown");
  });

  it("renders pillar bench strip, spanning label on continuation row, and pillar gap in kneeler map", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          makeSection({
            id: "s1",
            label: "West",
            rows: [
              {
                id: "row-9",
                label: "Row 9",
                frontType: "pew",
                kneelers: [
                  makeKneeler({ id: "k1", capacity: 3 }),
                  {
                    id: "pillar",
                    capacity: 2,
                    label: "Pillar",
                    hardware: [],
                  },
                  makeKneeler({ id: "k2", capacity: 3 }),
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
        ],
      },
    });
    const { SectionRowsPanel } = await import("./section-rows-panel");
    const { container } = render(<SectionRowsPanel
      section={project.layout.sections[0]}
      partNames={partNamesForSection(project.layout.sections[0])}
    />);

    expect(container.querySelectorAll("[title='Pillar']").length).toBeGreaterThan(0);
    expect(container.querySelector('[title="Pillar (gap)"]')).toBeTruthy();
  });

  it("shows unknown badge in inventory when unknown quantity is present", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          makeSection({
            id: "s1",
            rows: [
              {
                id: "r1",
                label: "Row 1",
                frontType: "pew",
                kneelers: [
                  makeKneeler({
                    hardware: [makeHardware({ name: "Mystery Part", quantity: 2, status: "unknown" })],
                  }),
                ],
              },
            ],
          }),
        ],
      },
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    expect(container).toHaveTextContent("Mystery Part");
    const mysteryRow = Array.from(container.querySelectorAll("tbody tr")).find((tr) =>
      tr.textContent?.includes("Mystery Part"),
    );
    expect(mysteryRow).toBeTruthy();
    const cells = mysteryRow!.querySelectorAll("td");
    // Part, Total, Inspected, Needed, Upcoming, Installed, Unknown
    expect(cells[6].textContent).toBe("2");
    expect(cells[6].querySelector("[class]")).toBeTruthy();
  });

  it("shows inspected badge in inventory when inspected quantity is present", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          makeSection({
            id: "s1",
            rows: [
              {
                id: "r1",
                label: "Row 1",
                frontType: "pew",
                kneelers: [
                  makeKneeler({
                    hardware: [makeHardware({ name: "Checked Part", quantity: 2, status: "inspected" })],
                  }),
                ],
              },
            ],
          }),
        ],
      },
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    expect(container).toHaveTextContent("Checked Part");
    const row = Array.from(container.querySelectorAll("tbody tr")).find((tr) =>
      tr.textContent?.includes("Checked Part"),
    );
    expect(row).toBeTruthy();
    const cells = row!.querySelectorAll("td");
    expect(cells[2].textContent).toBe("2");
    expect(cells[2].querySelector("[class]")).toBeTruthy();
  });

  it("renders inventory row without badges when count is zero", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          makeSection({
            id: "s1",
            rows: [
              {
                id: "r1",
                label: "Row 1",
                frontType: "pew",
                kneelers: [
                  makeKneeler({
                    hardware: [makeHardware({ name: "Foot", quantity: 3, status: "needed" })],
                  }),
                ],
              },
            ],
          }),
        ],
      },
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    expect(container).toHaveTextContent("Parts Inventory");
  });
});

describe("generateStaticParams", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.resetModules();
    mockReaddirSync.mockReset();
    mockReadFileSync.mockReset();
  });

  it("returns params for each project json file", async () => {
    mockReaddirSync.mockReturnValue(["saint-stanislaus.json", "other-church.json"]);

    const { generateStaticParams } = await import("./page");
    const params = generateStaticParams();

    expect(params).toEqual([
      { project: "saint-stanislaus" },
      { project: "other-church" },
    ]);
  });

  it("filters out non-json files", async () => {
    mockReaddirSync.mockReturnValue(["project.json", "readme.txt"]);

    const { generateStaticParams } = await import("./page");
    const params = generateStaticParams();

    expect(params).toEqual([{ project: "project" }]);
  });

  it("returns empty array when no projects exist", async () => {
    mockReaddirSync.mockReturnValue([]);

    const { generateStaticParams } = await import("./page");
    const params = generateStaticParams();

    expect(params).toEqual([]);
  });

  it("passes inventory updates data with date-by-status grid to InventoryUpdatesCard", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
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
                      makeHardware({ name: "Prayer Sole", quantity: 3, status: "installed", date: "2028-05-03" }),
                      makeHardware({ name: "Prayer Sole", quantity: 2, status: "needed", date: "2028-05-03" }),
                      makeHardware({ name: "Spacer", quantity: 1, status: "installed", date: "2028-05-03" }),
                      makeHardware({ name: "Spacer", quantity: 2, status: "installed", date: "2028-05-10" }),
                      makeHardware({ name: "Collar", quantity: 1, status: "needed" }),
                    ],
                  }),
                ],
              },
            ],
          }),
        ],
      },
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    const el = container.querySelector("[data-testid='inventory-updates']")!;
    const updatesData = JSON.parse(el.getAttribute("data-updates")!);

    expect(updatesData["Prayer Sole"]).toEqual([
      { date: "2028-05-03", inspected: 0, needed: 2, upcoming: 0, installed: 3 },
    ]);
    expect(updatesData["Spacer"]).toEqual([
      { date: "2028-05-03", inspected: 0, needed: 0, upcoming: 0, installed: 1 },
      { date: "2028-05-10", inspected: 0, needed: 0, upcoming: 0, installed: 2 },
    ]);
    expect(updatesData["Collar"]).toBeUndefined();
  });
});
