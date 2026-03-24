import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { PewMap } from "./pew-map";
import type { PewSection, ChurchOrientation, Kneeler, HardwareItem } from "@/data/types";
import * as navigation from "next/navigation";

afterEach(cleanup);

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

const orientation: ChurchOrientation = {
  altar: "N",
  entrance: "S",
  left: "W",
  right: "E",
};

describe("PewMap", () => {
  it("renders church name as title", () => {
    const { container } = render(
      <PewMap
        churchName="The Shrine Church of Saint Stanislaus"
        orientation={orientation}
        sections={[makeSection()]}
        partNames={["Kneeler Foot"]}
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
                  makeHardware({ name: "Kneeler Foot", quantity: 2, status: "needed" }),
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
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Kneeler Foot", "Kneeler Bushing"]} />,
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
                  makeHardware({ name: "Kneeler Foot", quantity: 3, status: "installed" }),
                  makeHardware({ name: "Kneeler Foot", quantity: 2, status: "needed" }),
                  makeHardware({ name: "Kneeler Bushing", quantity: 4, status: "needed" }),
                ],
              }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Kneeler Bushing", "Kneeler Foot"]} />,
    );

    // Default is Kneeler Bushing (most needed+upcoming = 4)
    expect(container).toHaveTextContent("0 / 4 Installed (0%)");

    // Switch to Kneeler Foot
    const select = container.querySelector("select")!;
    fireEvent.change(select, { target: { value: "Kneeler Foot" } });
    expect(container).toHaveTextContent("3 / 5 Installed (60%)");
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
                  makeHardware({ name: "Kneeler Foot", quantity: 3, status: "installed" }),
                  makeHardware({ name: "Kneeler Bushing", quantity: 2, status: "needed" }),
                ],
              }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Kneeler Bushing", "Kneeler Foot"]} />,
    );

    const select = container.querySelector("select")!;
    fireEvent.change(select, { target: { value: "Kneeler Foot" } });
    expect(container).toHaveTextContent("3 / 3 Installed (100%)");

    fireEvent.change(select, { target: { value: "Kneeler Bushing" } });
    expect(container).toHaveTextContent("0 / 2 Installed (0%)");
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
    expect(container).toHaveTextContent("3 / 6 Installed (50%)");
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
                hardware: [makeHardware({ name: "Kneeler Foot", status: "unknown" })],
              }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Kneeler Foot"]} />,
    );
    expect(container).toHaveTextContent("0 / 0 Installed (0%)");
  });

  it("renders Altar and Entrance labels without direction", () => {
    const { container } = render(
      <PewMap
        churchName="Test Church"
        orientation={orientation}
        sections={[makeSection()]}
        partNames={["Kneeler Foot"]}
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
        partNames={["Kneeler Foot"]}
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
        partNames={["Kneeler Foot", "Kneeler Bushing"]}
      />,
    );
    const select = container.querySelector("select")!;
    expect(select).toBeTruthy();
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toEqual(["Kneeler Foot", "Kneeler Bushing"]);
    expect(options).not.toContain("All Parts");
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
                  makeHardware({ name: "Kneeler Foot", status: "installed" }),
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
        partNames={["Kneeler Bushing", "Kneeler Foot"]}
      />,
    );

    // Default is Kneeler Bushing (most needed+upcoming) — should show amber (needed)
    expect(container.querySelectorAll(".bg-amber-100").length).toBeGreaterThan(0);

    // Select "Kneeler Foot" — should show green (installed)
    const select = container.querySelector("select")!;
    fireEvent.change(select, { target: { value: "Kneeler Foot" } });
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
                hardware: [makeHardware({ name: "Kneeler Foot", status: "needed" })],
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
        partNames={["Kneeler Bushing", "Kneeler Foot"]}
      />,
    );

    // Default is Kneeler Foot (only part with needed+upcoming)
    // Switch to Kneeler Bushing — kneeler doesn't have this part
    const select = container.querySelector("select")!;
    fireEvent.change(select, { target: { value: "Kneeler Bushing" } });
    expect(container.querySelectorAll(".bg-neutral-100").length).toBeGreaterThan(0);
  });

  it("renders cross aisle (transept) as full-width divider", () => {
    const sections: PewSection[] = [
      { id: "transept", label: "Transept", type: "crossAisle", side: "full", alignment: "full", group: 0, rows: [] },
    ];

    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Kneeler Foot"]} />,
    );
    expect(container).toHaveTextContent("Transept");
  });

  it("renders full-width pew section", () => {
    const sections = [makeSection({ id: "full-sec", label: "Full Section", side: "full", alignment: "full", group: 0 })];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Kneeler Foot"]} />,
    );
    expect(container).toHaveTextContent("Full Section");
  });

  it("renders outer-aligned sections with center gap", () => {
    const sections = [
      makeSection({ id: "cw", label: "Comm West", side: "west", alignment: "outer", group: 0 }),
      makeSection({ id: "ce", label: "Comm East", side: "east", alignment: "outer", group: 0 }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Kneeler Foot"]} />,
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
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Kneeler Foot"]} />,
    );
    expect(container).toHaveTextContent("West Outer");
    expect(container).toHaveTextContent("East Outer");
  });

  it("falls back to nave alignment when group has only outer sections", () => {
    const sections = [
      makeSection({ id: "wo", label: "West Outer Only", side: "westOuter", group: 0 }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Kneeler Foot"]} />,
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
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Kneeler Foot"]} />,
    );
    expect(container).toHaveTextContent("0k");
  });

  it("renders section stats (rows, kneelers, pct)", () => {
    const { container } = render(
      <PewMap
        churchName="Test"
        orientation={orientation}
        sections={[makeSection()]}
        partNames={["Kneeler Foot"]}
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
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Kneeler Foot"]} />,
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
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Kneeler Foot"]} />,
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
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Kneeler Foot"]} />,
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
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Kneeler Foot"]} />,
    );
    expect(container.querySelectorAll(".bg-neutral-100").length).toBeGreaterThan(0);
  });

  it("initializes filter from URL search params", () => {
    vi.spyOn(navigation, "useSearchParams").mockReturnValue(
      new URLSearchParams("part=kneeler-foot") as ReturnType<typeof navigation.useSearchParams>,
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
                  makeHardware({ name: "Kneeler Foot", quantity: 3, status: "installed" }),
                  makeHardware({ name: "Kneeler Bushing", quantity: 2, status: "needed" }),
                ],
              }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Kneeler Bushing", "Kneeler Foot"]} />,
    );

    // URL param overrides default (Kneeler Bushing would be default by count)
    expect(container).toHaveTextContent("3 / 3 Installed (100%)");
    const select = container.querySelector("select")!;
    expect(select.value).toBe("Kneeler Foot");

    vi.restoreAllMocks();
  });
});
