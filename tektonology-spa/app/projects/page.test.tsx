import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { Project } from "@/data/types";

const mockReaddirSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockExistsSync = vi.fn();

vi.mock("fs", () => ({
  default: { readFileSync: (...args: unknown[]) => mockReadFileSync(...args), readdirSync: (...args: unknown[]) => mockReaddirSync(...args), existsSync: (...args: unknown[]) => mockExistsSync(...args) },
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}));

vi.mock("@/components/product-thumbnail", () => ({
  ProductThumbnail: ({ product }: { product: { name: string } }) => <div data-testid={`thumbnail-${product.name}`} />,
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
                  { partId: "foot", name: "Prayer Sole", quantity: 3, status: "installed", date: "2026-03-15" },
                  { partId: "foot", name: "Prayer Sole", quantity: 2, status: "needed" },
                  { partId: "kneeler-bushing", name: "Kneeler Bushing", quantity: 2, status: "upcoming", date: "2026-03-31" },
                  { partId: "kneeler-bushing", name: "Kneeler Bushing", quantity: 1, status: "needed" },
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
    mockExistsSync.mockReset();
    mockExistsSync.mockReturnValue(false);
  });

  it("renders project list heading", async () => {
    mockReaddirSync.mockReturnValue([]);
    const { default: ProjectsPage } = await import("./page");
    const { container } = render(ProjectsPage());
    expect(container.querySelector("h1")).toHaveTextContent("Projects");
  });

  it("renders project name, church, and layout stats", async () => {
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
  });

  it("renders per-part progress bars with correct percentages", async () => {
    const project = makeProject();
    mockReaddirSync.mockReturnValue(["test-project.json"]);
    mockReadFileSync.mockReturnValue(JSON.stringify(project));

    const { default: ProjectsPage } = await import("./page");
    const { container } = render(ProjectsPage());

    // Foot: 3 installed / 5 total = 60%
    expect(container).toHaveTextContent("Prayer Sole");
    expect(container).toHaveTextContent("3 / 5 units resolved");
    expect(container).toHaveTextContent("60%");

    // Collar: 0 installed / 3 total = 0%
    expect(container).toHaveTextContent("Kneeler Bushing");
    expect(container).toHaveTextContent("0 / 3 units resolved");
    expect(container).toHaveTextContent("0%");
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

    const text = container.textContent ?? "";
    const alphaIdx = text.indexOf("Alpha");
    const betaIdx = text.indexOf("Beta");
    expect(alphaIdx).toBeGreaterThan(-1);
    expect(betaIdx).toBeGreaterThan(-1);
    expect(alphaIdx).toBeLessThan(betaIdx);
  });

  it("filters non-json files from directory listing", async () => {
    const project = makeProject();
    mockReaddirSync.mockReturnValue(["test.json", "readme.txt"]);
    mockReadFileSync.mockReturnValue(JSON.stringify(project));

    const { default: ProjectsPage } = await import("./page");
    render(ProjectsPage());

    // 1 project file + 0 product files (existsSync returns false)
    expect(mockReadFileSync).toHaveBeenCalledTimes(1);
  });

  it("renders empty list when no projects exist", async () => {
    mockReaddirSync.mockReturnValue([]);
    const { default: ProjectsPage } = await import("./page");
    const { container } = render(ProjectsPage());

    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("does not show part section when no parts have needed status", async () => {
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
            rows: [{
              id: "r1", label: "R1", frontType: "pew",
              kneelers: [{
                id: "k1", capacity: 3,
                hardware: [
                  { partId: "foot", name: "Prayer Sole", quantity: 3, status: "installed", date: "2026-03-15" },
                ],
              }],
            }],
          },
        ],
      },
    });
    mockReaddirSync.mockReturnValue(["test.json"]);
    mockReadFileSync.mockReturnValue(JSON.stringify(project));

    const { default: ProjectsPage } = await import("./page");
    const { container } = render(ProjectsPage());

    expect(container).not.toHaveTextContent("Prayer Sole");
    expect(container).not.toHaveTextContent("installed");
  });

  it("shows product thumbnail and link when product exists", async () => {
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
            rows: [{
              id: "r1", label: "R1", frontType: "pew",
              kneelers: [{
                id: "k1", capacity: 2,
                hardware: [
                  { partId: "kneeler-boot", name: "Kneeler Boot", quantity: 2, status: "needed" },
                ],
              }],
            }],
          },
        ],
      },
    });
    const productJson = JSON.stringify({
      id: "kneeler-boot", name: "Kneeler Boot", category: "Parts",
      description: "", printSettings: {}, assemblyGuide: [],
      stlDownloadUrls: [{ label: "Boot", url: "/stl/boot.stl" }], purchaseLinks: [],
    });
    mockReaddirSync.mockReturnValue(["test.json"]);
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes("kneeler-boot.json")) return productJson;
      return JSON.stringify(project);
    });

    const { default: ProjectsPage } = await import("./page");
    const { container } = render(ProjectsPage());

    const productLink = container.querySelector('a[href="/products/kneeler-boot"]');
    expect(productLink).toBeTruthy();
    expect(container.querySelector('[data-testid="thumbnail-Kneeler Boot"]')).toBeTruthy();
  });

  it("handles zero-total part gracefully (0%)", async () => {
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
            rows: [{
              id: "r1", label: "R1", frontType: "pew",
              kneelers: [{
                id: "k1", capacity: 2,
                hardware: [
                  { partId: "spacer", name: "Spacer", quantity: 0, status: "needed" },
                ],
              }],
            }],
          },
        ],
      },
    });
    mockReaddirSync.mockReturnValue(["test.json"]);
    mockReadFileSync.mockReturnValue(JSON.stringify(project));

    const { default: ProjectsPage } = await import("./page");
    const { container } = render(ProjectsPage());

    expect(container).toHaveTextContent("Spacer");
    expect(container).toHaveTextContent("0%");
    expect(container).toHaveTextContent("0 / 0 units resolved");
  });

  it("renders installation map links with tokenized part filter", async () => {
    const project = makeProject();
    mockReaddirSync.mockReturnValue(["test.json"]);
    mockReadFileSync.mockReturnValue(JSON.stringify(project));

    const { default: ProjectsPage } = await import("./page");
    const { container } = render(ProjectsPage());

    const mapLinks = container.querySelectorAll('a[href="/projects/test-project?part=prayer-sole"]');
    // Part name link + Installation Map link
    expect(mapLinks.length).toBe(2);
    expect(mapLinks[0]).toHaveTextContent("Prayer Sole");
    expect(mapLinks[1]).toHaveTextContent("Installation Map");
  });

  it("renders separate sections for each part with needed items", async () => {
    const project = makeProject();
    mockReaddirSync.mockReturnValue(["test.json"]);
    mockReadFileSync.mockReturnValue(JSON.stringify(project));

    const { default: ProjectsPage } = await import("./page");
    const { container } = render(ProjectsPage());

    // Both parts should have their own progress info
    expect(container).toHaveTextContent("Prayer Sole");
    expect(container).toHaveTextContent("3 / 5 units resolved");
    expect(container).toHaveTextContent("Kneeler Bushing");
    expect(container).toHaveTextContent("0 / 3 units resolved");
  });
});
