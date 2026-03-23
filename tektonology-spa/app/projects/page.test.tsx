import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { Project } from "@/data/types";

const mockReaddirSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock("fs", () => ({
  default: { readFileSync: (...args: unknown[]) => mockReadFileSync(...args), readdirSync: (...args: unknown[]) => mockReaddirSync(...args) },
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: "test-project",
  name: "Test Project",
  church: "Test Church",
  description: "A test project",
  layout: {
    orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
    aisles: [{ id: "nave", name: "Nave" }],
    sections: [
      {
        id: "sec-1",
        label: "Section 1",
        type: "pews",
        side: "west",
        alignment: "nave",
        group: 0,
        rows: [
          {
            id: "row-1",
            label: "Row 1",
            frontType: "pew",
            kneelers: [
              {
                id: "k1",
                capacity: 3,
                hardware: [
                  { partId: "foot", name: "Kneeler Foot", quantity: 3, status: "installed" },
                  { partId: "collar", name: "Collar", quantity: 2, status: "needed" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  ...overrides,
});

describe("ProjectsPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.resetModules();
    mockReaddirSync.mockReset();
    mockReadFileSync.mockReset();
  });

  it("renders project list heading", async () => {
    mockReaddirSync.mockReturnValue([]);
    const { default: ProjectsPage } = await import("./page");
    const { container } = render(ProjectsPage());
    expect(container.querySelector("h1")).toHaveTextContent("Projects");
  });

  it("renders project cards with stats", async () => {
    const project = makeProject();
    mockReaddirSync.mockReturnValue(["test-project.json"]);
    mockReadFileSync.mockReturnValue(JSON.stringify(project));

    const { default: ProjectsPage } = await import("./page");
    const { container } = render(ProjectsPage());

    expect(container).toHaveTextContent("Test Project");
    expect(container).toHaveTextContent("Test Church");
    expect(container).toHaveTextContent("1 sections");
    expect(container).toHaveTextContent("1 rows");
    expect(container).toHaveTextContent("1 kneelers");
    expect(container).toHaveTextContent("5 parts");
    expect(container).toHaveTextContent("3 installed");
  });

  it("links to project detail page", async () => {
    const project = makeProject();
    mockReaddirSync.mockReturnValue(["test-project.json"]);
    mockReadFileSync.mockReturnValue(JSON.stringify(project));

    const { default: ProjectsPage } = await import("./page");
    const { container } = render(ProjectsPage());

    const link = container.querySelector('a[href="/projects/test-project"]');
    expect(link).toBeTruthy();
  });

  it("sorts projects by name", async () => {
    const projectA = makeProject({ id: "a", name: "Alpha" });
    const projectB = makeProject({ id: "b", name: "Beta" });
    mockReaddirSync.mockReturnValue(["b.json", "a.json"]);
    mockReadFileSync
      .mockReturnValueOnce(JSON.stringify(projectB))
      .mockReturnValueOnce(JSON.stringify(projectA));

    const { default: ProjectsPage } = await import("./page");
    const { container } = render(ProjectsPage());

    const cards = container.querySelectorAll("a");
    expect(cards[0]).toHaveAttribute("href", "/projects/a");
    expect(cards[1]).toHaveAttribute("href", "/projects/b");
  });

  it("filters non-json files from directory listing", async () => {
    const project = makeProject();
    mockReaddirSync.mockReturnValue(["test.json", "readme.txt"]);
    mockReadFileSync.mockReturnValue(JSON.stringify(project));

    const { default: ProjectsPage } = await import("./page");
    render(ProjectsPage());

    expect(mockReadFileSync).toHaveBeenCalledTimes(1);
  });

  it("shows 0% installed when project has no parts", async () => {
    const project = makeProject({
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          {
            id: "s1",
            label: "S1",
            type: "pews",
            side: "full",
            alignment: "full",
            group: 0,
            rows: [{ id: "r1", label: "R1", frontType: "pew", kneelers: [] }],
          },
        ],
      },
    });
    mockReaddirSync.mockReturnValue(["empty.json"]);
    mockReadFileSync.mockReturnValue(JSON.stringify(project));

    const { default: ProjectsPage } = await import("./page");
    const { container } = render(ProjectsPage());

    expect(container).toHaveTextContent("0%");
  });

  it("renders empty list when no projects exist", async () => {
    mockReaddirSync.mockReturnValue([]);
    const { default: ProjectsPage } = await import("./page");
    const { container } = render(ProjectsPage());

    expect(container.querySelectorAll("a")).toHaveLength(0);
  });
});
