import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

const mockNotFound = vi.fn();
const mockListSectionParams = vi.fn(() => [] as { project: string; section: string }[]);

vi.mock("next/navigation", () => ({
  notFound: (...args: unknown[]) => mockNotFound(),
}));

vi.mock("../../pew-map", () => ({
  PewMap: () => <div data-testid="pew-map-section" />,
}));

vi.mock("../../section-rows-panel", () => ({
  SectionRowsPanel: () => <div data-testid="section-rows" />,
}));

vi.mock("@/lib/project-data", () => ({
  getProject: vi.fn(),
  listProjectSectionStaticParams: () => mockListSectionParams(),
}));

describe("ProjectSectionPage generateStaticParams", () => {
  beforeEach(() => {
    vi.resetModules();
    mockListSectionParams.mockReset();
    mockListSectionParams.mockReturnValue([{ project: "a", section: "s1" }]);
  });

  it("delegates to listProjectSectionStaticParams", async () => {
    const { generateStaticParams } = await import("./page");
    expect(generateStaticParams()).toEqual([{ project: "a", section: "s1" }]);
  });
});

describe("ProjectSectionPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.resetModules();
    mockNotFound.mockReset();
  });

  it("calls notFound when section is crossAisle", async () => {
    const { getProject } = await import("@/lib/project-data");
    vi.mocked(getProject).mockReturnValue({
      id: "p",
      name: "P",
      church: "C",
      description: "",
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          {
            id: "transept",
            label: "Transept",
            type: "crossAisle",
            side: "full",
            alignment: "full",
            group: 1,
            rows: [],
          },
        ],
      },
    });
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    const { default: Page } = await import("./page");
    await expect(
      Page({ params: Promise.resolve({ project: "p", section: "transept" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("calls notFound when section is missing", async () => {
    const { getProject } = await import("@/lib/project-data");
    vi.mocked(getProject).mockReturnValue({
      id: "p",
      name: "P",
      church: "C",
      description: "",
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [],
      },
    });
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    const { default: Page } = await import("./page");
    await expect(
      Page({ params: Promise.resolve({ project: "p", section: "nope" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("renders section title and pew map", async () => {
    const { getProject } = await import("@/lib/project-data");
    vi.mocked(getProject).mockReturnValue({
      id: "p",
      name: "Project Name",
      church: "St Test",
      description: "",
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          {
            id: "west-main",
            label: "West Main",
            type: "pews",
            side: "west",
            alignment: "nave",
            group: 0,
            rows: [
              {
                id: "r1",
                label: "Row 1",
                frontType: "pew" as const,
                kneelers: [
                  {
                    id: "k1",
                    capacity: 3,
                    hardware: [{ partId: "x", name: "Bolt", quantity: 1, status: "unknown" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const { default: Page } = await import("./page");
    const { container } = render(
      await Page({ params: Promise.resolve({ project: "p", section: "west-main" }) }),
    );

    expect(container).toHaveTextContent("West Main");
    expect(container).toHaveTextContent("St Test");
    expect(container.querySelector("[data-testid='pew-map-section']")).toBeTruthy();
    expect(container.querySelector("[data-testid='section-rows']")).toBeTruthy();
    const back = container.querySelector('a[href="/projects/p/"]');
    expect(back).toBeTruthy();
    expect(back).toHaveTextContent("Project Name");
  });

  it("renders when project has no hardware anywhere (empty part list)", async () => {
    const { getProject } = await import("@/lib/project-data");
    vi.mocked(getProject).mockReturnValue({
      id: "p",
      name: "Empty HW",
      church: "St Empty",
      description: "",
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          {
            id: "west-main",
            label: "West Main",
            type: "pews",
            side: "west",
            alignment: "nave",
            group: 0,
            rows: [
              {
                id: "r1",
                label: "Row 1",
                frontType: "pew" as const,
                kneelers: [{ id: "k1", capacity: 3, hardware: [] }],
              },
            ],
          },
        ],
      },
    });

    const { default: Page } = await import("./page");
    const { container } = render(
      await Page({ params: Promise.resolve({ project: "p", section: "west-main" }) }),
    );

    expect(container).toHaveTextContent("West Main");
    expect(container.querySelector("[data-testid='pew-map-section']")).toBeTruthy();
  });

  it("renders full-width and omits alignment line when alignment is full", async () => {
    const { getProject } = await import("@/lib/project-data");
    vi.mocked(getProject).mockReturnValue({
      id: "p",
      name: "Wide",
      church: "St Wide",
      description: "",
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          {
            id: "nave-all",
            label: "Nave All",
            type: "pews",
            side: "full",
            alignment: "full",
            group: 0,
            rows: [],
          },
        ],
      },
    });

    const { default: Page } = await import("./page");
    const { container } = render(
      await Page({ params: Promise.resolve({ project: "p", section: "nave-all" }) }),
    );

    expect(container).toHaveTextContent("Full width");
    expect(container.textContent).not.toMatch(/aligned/i);
  });

  it("renders outer alignment label when alignment is outer", async () => {
    const { getProject } = await import("@/lib/project-data");
    vi.mocked(getProject).mockReturnValue({
      id: "p",
      name: "Outer",
      church: "St Outer",
      description: "",
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          {
            id: "west-outer",
            label: "West Outer",
            type: "pews",
            side: "west",
            alignment: "outer",
            group: 0,
            rows: [],
          },
        ],
      },
    });

    const { default: Page } = await import("./page");
    const { container } = render(
      await Page({ params: Promise.resolve({ project: "p", section: "west-outer" }) }),
    );

    expect(container).toHaveTextContent("Outer aligned");
  });

  it("renders nave alignment label when alignment is nave", async () => {
    const { getProject } = await import("@/lib/project-data");
    vi.mocked(getProject).mockReturnValue({
      id: "p",
      name: "Nave",
      church: "St Nave",
      description: "",
      layout: {
        orientation: { altar: "N", entrance: "S", left: "W", right: "E" },
        aisles: [],
        sections: [
          {
            id: "west-nave",
            label: "West Nave",
            type: "pews",
            side: "west",
            alignment: "nave",
            group: 0,
            rows: [],
          },
        ],
      },
    });

    const { default: Page } = await import("./page");
    const { container } = render(
      await Page({ params: Promise.resolve({ project: "p", section: "west-nave" }) }),
    );

    expect(container).toHaveTextContent("West side");
    expect(container).toHaveTextContent("Nave aligned");
  });

  it("calls notFound when project json is missing", async () => {
    const { getProject } = await import("@/lib/project-data");
    vi.mocked(getProject).mockReturnValue(undefined);
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    const { default: Page } = await import("./page");
    await expect(
      Page({ params: Promise.resolve({ project: "missing", section: "west-main" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });
});
