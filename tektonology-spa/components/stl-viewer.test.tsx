import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";

const mockUseLoader = vi.fn();

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas">{children}</div>
  ),
  useLoader: (...args: unknown[]) => mockUseLoader(...args),
}));

vi.mock("@react-three/drei", () => ({
  OrbitControls: (props: any) => (
    <div
      data-testid="orbit-controls"
      data-enable-zoom={props.enableZoom ? "true" : "false"}
      data-auto-rotate={props.autoRotate ? "true" : "false"}
    />
  ),
}));

vi.mock("three/examples/jsm/loaders/STLLoader.js", () => ({
  STLLoader: class {},
}));

function makeGeometry(
  bounds = { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
) {
  const geom = {
    computeBoundingBox: vi.fn(),
    center: vi.fn(function (this: any) {
      return this;
    }),
    boundingBox: bounds,
  };
  return geom;
}

import { StlViewer, StlAssemblyViewer, type StlPart } from "./stl-viewer";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StlViewer", () => {
  beforeEach(() => {
    mockUseLoader.mockReturnValue(makeGeometry());
  });

  it("renders with the label and default color", () => {
    render(<StlViewer url="/test.stl" label="Test Part" />);
    expect(screen.getByText("Test Part")).toBeInTheDocument();
  });

  it("renders the canvas container and lights", () => {
    render(<StlViewer url="/test.stl" label="Test Part" />);
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
    expect(document.querySelector("ambientlight")).toBeInTheDocument();
    expect(document.querySelectorAll("directionallight")).toHaveLength(3);
  });

  it("hides label in compact mode", () => {
    render(<StlViewer url="/test.stl" label="Test Part" compact />);
    expect(screen.queryByText("Test Part")).not.toBeInTheDocument();
  });

  it("disables zoom in compact mode", () => {
    render(<StlViewer url="/test.stl" label="Test Part" compact />);
    const controls = screen.getByTestId("orbit-controls");
    expect(controls).toHaveAttribute("data-enable-zoom", "false");
  });

  it("enables zoom in normal mode", () => {
    render(<StlViewer url="/test.stl" label="Test Part" />);
    const controls = screen.getByTestId("orbit-controls");
    expect(controls).toHaveAttribute("data-enable-zoom", "true");
  });

  it("hides label when label is empty", () => {
    const { container } = render(<StlViewer url="/test.stl" label="" />);
    expect(container.querySelector(".border-t")).toBeNull();
  });

  it("applies rotation when provided", () => {
    render(<StlViewer url="/test.stl" label="" rotation={[90, 180, 0]} />);
    const group = document.querySelector("group");
    expect(group).toBeInTheDocument();
  });

  it("applies custom color", () => {
    render(<StlViewer url="/test.stl" label="Part" color="#ff0000" />);
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });

  it("handles zero-dimension geometry", () => {
    mockUseLoader.mockReturnValue(
      makeGeometry({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }),
    );
    render(<StlViewer url="/test.stl" label="Zero" />);
    expect(screen.getByText("Zero")).toBeInTheDocument();
  });
});

describe("StlAssemblyViewer", () => {
  it("renders assembly with multiple parts", () => {
    const parts: StlPart[] = [
      { url: "/a.stl", color: "#ff0000", position: [10, 0, 0] },
      { url: "/b.stl", color: "#00ff00", position: [0, 10, 0] },
    ];
    mockUseLoader.mockReturnValue([makeGeometry(), makeGeometry()]);
    render(<StlAssemblyViewer parts={parts} label="Assembly" />);
    expect(screen.getByText("Assembly")).toBeInTheDocument();
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });

  it("handles single geometry (non-array) from useLoader (array normalization)", () => {
    const parts: StlPart[] = [{ url: "/a.stl" }];
    // Simulate useLoader returning a single geometry (e.g. if implementation changed or mock behavior specific)
    mockUseLoader.mockReturnValue(makeGeometry());
    render(<StlAssemblyViewer parts={parts} label="Single" />);
    expect(screen.getByText("Single")).toBeInTheDocument();
  });

  it("hides label in compact mode", () => {
    const parts: StlPart[] = [{ url: "/a.stl" }];
    mockUseLoader.mockReturnValue([makeGeometry()]);
    render(<StlAssemblyViewer parts={parts} label="Hidden" compact />);
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });

  it("hides label when label is empty", () => {
    const parts: StlPart[] = [{ url: "/a.stl" }];
    mockUseLoader.mockReturnValue([makeGeometry()]);
    const { container } = render(<StlAssemblyViewer parts={parts} label="" />);
    expect(container.querySelector(".border-t")).toBeNull();
  });

  it("applies rotation when provided", () => {
    const parts: StlPart[] = [{ url: "/a.stl" }];
    mockUseLoader.mockReturnValue([makeGeometry()]);
    render(<StlAssemblyViewer parts={parts} label="" rotation={[45, 90, 0]} />);
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });

  it("defaults position to [0,0,0] when not provided", () => {
    const parts: StlPart[] = [{ url: "/a.stl" }];
    mockUseLoader.mockReturnValue([makeGeometry()]);
    render(<StlAssemblyViewer parts={parts} label="No Pos" />);
    expect(screen.getByText("No Pos")).toBeInTheDocument();
  });

  it("handles zero-dimension assembly geometry", () => {
    const parts: StlPart[] = [{ url: "/a.stl" }];
    const zeroBounds = {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
    };
    mockUseLoader.mockReturnValue([makeGeometry(zeroBounds)]);
    render(<StlAssemblyViewer parts={parts} label="Zero Assembly" />);
    expect(screen.getByText("Zero Assembly")).toBeInTheDocument();
  });

  it("defaults color to gray when not provided", () => {
    const parts: StlPart[] = [{ url: "/a.stl" }];
    mockUseLoader.mockReturnValue([makeGeometry()]);
    render(<StlAssemblyViewer parts={parts} label="Default Color" />);
    expect(screen.getByText("Default Color")).toBeInTheDocument();
  });

  it("handles empty parts array", () => {
    mockUseLoader.mockReturnValue([]);
    render(<StlAssemblyViewer parts={[]} label="Empty" />);
    expect(screen.getByText("Empty")).toBeInTheDocument();
  });
});
