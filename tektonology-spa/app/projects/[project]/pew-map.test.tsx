import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { PewMap } from "./pew-map";
import type { PewSection, ChurchOrientation, Kneeler, HardwareItem } from "@/data/types";

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

  it("renders summary with installed count and percentage", () => {
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
                  makeHardware({ name: "Collar", quantity: 2, status: "needed" }),
                ],
              }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Collar", "Kneeler Foot"]} />,
    );
    expect(container).toHaveTextContent("3 / 5 installed (60%)");
  });

  it("updates summary when part filter is selected", () => {
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
                  makeHardware({ name: "Collar", quantity: 2, status: "needed" }),
                ],
              }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={["Collar", "Kneeler Foot"]} />,
    );

    const select = container.querySelector("select")!;
    fireEvent.change(select, { target: { value: "Kneeler Foot" } });
    expect(container).toHaveTextContent("3 / 3 installed (100%)");

    fireEvent.change(select, { target: { value: "Collar" } });
    expect(container).toHaveTextContent("0 / 2 installed (0%)");
  });

  it("shows 0% when no trackable parts exist", () => {
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
                hardware: [makeHardware({ status: "unknown" })],
              }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={[]} />,
    );
    expect(container).toHaveTextContent("0 / 0 installed (0%)");
  });

  it("renders Altar and Entrance labels without direction", () => {
    const { container } = render(
      <PewMap
        churchName="Test Church"
        orientation={orientation}
        sections={[makeSection()]}
        partNames={[]}
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
        partNames={[]}
      />,
    );
    expect(container).toHaveTextContent("N");
    expect(container).toHaveTextContent("S");
    expect(container).toHaveTextContent("W");
    expect(container).toHaveTextContent("E");
  });

  it("renders part filter dropdown with All Parts default", () => {
    const { container } = render(
      <PewMap
        churchName="Test Church"
        orientation={orientation}
        sections={[makeSection()]}
        partNames={["Kneeler Foot", "Collar"]}
      />,
    );
    const select = container.querySelector("select")!;
    expect(select).toBeTruthy();
    expect(select.value).toBe("");
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toEqual(["All Parts", "Kneeler Foot", "Collar"]);
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
                  makeHardware({ name: "Collar", status: "needed" }),
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
        partNames={["Collar", "Kneeler Foot"]}
      />,
    );

    // Default "All Parts" — kneeler has mixed statuses so should be "upcoming" (blue)
    expect(container.querySelectorAll(".bg-blue-100").length).toBeGreaterThan(0);

    // Select "Kneeler Foot" — should show green (installed)
    const select = container.querySelector("select")!;
    fireEvent.change(select, { target: { value: "Kneeler Foot" } });
    expect(container.querySelectorAll(".bg-green-100").length).toBeGreaterThan(0);

    // Select "Collar" — should show amber (needed)
    fireEvent.change(select, { target: { value: "Collar" } });
    expect(container.querySelectorAll(".bg-amber-100").length).toBeGreaterThan(0);

    // Switch back to All Parts
    fireEvent.change(select, { target: { value: "" } });
    expect(container.querySelectorAll(".bg-blue-100").length).toBeGreaterThan(0);
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
        partNames={["Collar", "Kneeler Foot"]}
      />,
    );

    // Select "Collar" — kneeler doesn't have this part
    const select = container.querySelector("select")!;
    fireEvent.change(select, { target: { value: "Collar" } });
    expect(container.querySelectorAll(".bg-neutral-100").length).toBeGreaterThan(0);
  });

  it("renders cross aisle (transept) as full-width divider", () => {
    const sections: PewSection[] = [
      { id: "transept", label: "Transept", type: "crossAisle", side: "full", alignment: "full", group: 0, rows: [] },
    ];

    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={[]} />,
    );
    expect(container).toHaveTextContent("Transept");
  });

  it("renders full-width pew section", () => {
    const sections = [makeSection({ id: "full-sec", label: "Full Section", side: "full", alignment: "full", group: 0 })];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={[]} />,
    );
    expect(container).toHaveTextContent("Full Section");
  });

  it("renders outer-aligned sections with center gap", () => {
    const sections = [
      makeSection({ id: "cw", label: "Comm West", side: "west", alignment: "outer", group: 0 }),
      makeSection({ id: "ce", label: "Comm East", side: "east", alignment: "outer", group: 0 }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={[]} />,
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
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={[]} />,
    );
    expect(container).toHaveTextContent("West Outer");
    expect(container).toHaveTextContent("East Outer");
  });

  it("falls back to nave alignment when group has only outer sections", () => {
    const sections = [
      makeSection({ id: "wo", label: "West Outer Only", side: "westOuter", group: 0 }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={[]} />,
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
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={[]} />,
    );
    expect(container).toHaveTextContent("0k");
  });

  it("renders section stats (rows, kneelers, pct)", () => {
    const { container } = render(
      <PewMap
        churchName="Test"
        orientation={orientation}
        sections={[makeSection()]}
        partNames={[]}
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
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={[]} />,
    );
    // W and E aisle labels should appear (from compass rose + aisle labels)
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
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={[]} />,
    );
    expect(container).toHaveTextContent("100%");
  });

  it("renders kneeler as needed when no filter and all hardware needed", () => {
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
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={[]} />,
    );
    // Kneeler segment should have the needed color (amber)
    expect(container.querySelectorAll(".bg-amber-100").length).toBeGreaterThan(0);
  });

  it("renders kneeler with upcoming status when some hardware installed", () => {
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
                  makeHardware({ status: "installed" }),
                  makeHardware({ status: "needed" }),
                ],
              }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={[]} />,
    );
    expect(container.querySelectorAll(".bg-blue-100").length).toBeGreaterThan(0);
  });

  it("shows unknown for empty kneeler hardware with no filter", () => {
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
    expect(container.querySelectorAll(".bg-neutral-200").length).toBeGreaterThan(0);
  });

  it("shows unknown when all hardware is unknown", () => {
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
                hardware: [makeHardware({ status: "unknown" })],
              }),
            ],
          },
        ],
      }),
    ];
    const { container } = render(
      <PewMap churchName="Test" orientation={orientation} sections={sections} partNames={[]} />,
    );
    expect(container.querySelectorAll(".bg-neutral-200").length).toBeGreaterThan(0);
  });
});
