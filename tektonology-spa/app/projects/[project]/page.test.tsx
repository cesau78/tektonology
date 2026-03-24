import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { Project, PewSection, Kneeler, HardwareItem } from "@/data/types";

const mockReaddirSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockNotFound = vi.fn();

vi.mock("fs", () => ({
  default: { readFileSync: (...args: unknown[]) => mockReadFileSync(...args), readdirSync: (...args: unknown[]) => mockReaddirSync(...args) },
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
}));

vi.mock("next/navigation", () => ({
  notFound: (...args: unknown[]) => mockNotFound(...args),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("./pew-map", () => ({
  PewMap: ({ churchName, partNames }: { churchName: string; partNames: string[] }) => (
    <div data-testid="pew-map" data-church={churchName} data-parts={partNames.join(",")} />
  ),
}));

function makeHardware(overrides: Partial<HardwareItem> = {}): HardwareItem {
  return { partId: "foot", name: "Kneeler Foot", quantity: 3, status: "needed", ...overrides };
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
                      makeHardware({ name: "Kneeler Foot" }),
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
    expect(pewMap.getAttribute("data-parts")).toBe("Collar,Kneeler Foot");
  });

  it("renders legend with all statuses", async () => {
    const project = makeProject();
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    expect(container).toHaveTextContent("Pew / Rail");
    expect(container).toHaveTextContent("Unknown");
    expect(container).toHaveTextContent("Parts Needed");
    expect(container).toHaveTextContent("Upcoming");
    expect(container).toHaveTextContent("Installed");
  });

  it("does not render crossAisle sections in detail cards", async () => {
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

    const transeptCard = container.querySelector("#transept");
    expect(transeptCard).toBeNull();
  });

  it("renders section detail with side label for non-full sections", async () => {
    const project = makeProject();
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    expect(container).toHaveTextContent("West side");
    expect(container).toHaveTextContent("Nave aligned");
  });

  it("renders full-width section detail label", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          makeSection({ id: "full-sec", label: "Full Section", side: "full", alignment: "full", group: 0 }),
        ],
      },
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    expect(container).toHaveTextContent("Full width");
  });

  it("renders outer-aligned section detail label", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          makeSection({ id: "outer-sec", label: "Outer Section", side: "west", alignment: "outer", group: 0 }),
        ],
      },
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    expect(container).toHaveTextContent("Outer aligned");
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
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    expect(container).toHaveTextContent("Communion Rail");
    expect(container).toHaveTextContent("Pew");
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
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

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
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    expect(container).toHaveTextContent("Foot");
    expect(container).toHaveTextContent("Collar");
    expect(container).toHaveTextContent("Spacer");
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
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

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
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

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
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

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
                      makeHardware({ name: "Kneeler Foot", quantity: 3, status: "needed" }),
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
    expect(container).toHaveTextContent("Kneeler Foot");
    expect(container).toHaveTextContent("Collar");
    expect(container).toHaveTextContent("Spacer");
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
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    expect(container).toHaveTextContent("Kneeler 1");
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
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    expect(container).toHaveTextContent("Custom Label");
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
    mockReadFileSync.mockReturnValue(JSON.stringify(project));
    mockReaddirSync.mockReturnValue(["test-project.json"]);

    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ project: "test-project" }) }));

    expect(container).toHaveTextContent("Installed");
    expect(container).toHaveTextContent("2026-03-15");
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
});
