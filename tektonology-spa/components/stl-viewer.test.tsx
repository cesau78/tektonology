import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const mockUseLoader = vi.fn();

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas">{children}</div>
  ),
  useLoader: (...args: unknown[]) => mockUseLoader(...args),
}));

vi.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
}));

vi.mock("three/examples/jsm/loaders/STLLoader.js", () => ({
  STLLoader: class {},
}));

vi.mock("three", () => {
  class Box3 {
    setFromBufferGeometry() { return this; }
    getSize() { return { x: 1, y: 1, z: 1 }; }
  }
  class Vector3 {}
  return { Box3, Vector3 };
});

function makeGeometry(bounds = { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } }) {
  const geom = {
    computeBoundingBox: vi.fn(),
    center: vi.fn(() => geom),
    boundingBox: bounds,
  };
  return geom;
}

import { StlViewer, StlAssemblyViewer } from "./stl-viewer";

afterEach(cleanup);

describe("StlViewer", () => {
  beforeEach(() => {
    mockUseLoader.mockReturnValue(makeGeometry());
  });

  it("renders with the label", () => {
    render(<StlViewer url="/test.stl" label="Test Part" />);
    expect(screen.getByText("Test Part")).toBeInTheDocument();
  });

  it("renders the canvas container", () => {
    render(<StlViewer url="/test.stl" label="Test Part" />);
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });

  it("hides label in compact mode", () => {
    render(<StlViewer url="/test.stl" label="Test Part" compact />);
    expect(screen.queryByText("Test Part")).not.toBeInTheDocument();
  });

  it("hides label when label is empty", () => {
    const { container } = render(<StlViewer url="/test.stl" label="" />);
    expect(container.querySelector(".border-t")).toBeNull();
  });

  it("applies rotation when provided", () => {
    const { container } = render(<StlViewer url="/test.stl" label="" rotation={[90, 0, 0]} />);
    expect(container.querySelector("[data-testid='canvas']")).toBeInTheDocument();
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
    const parts = [
      { url: "/a.stl", color: "#ff0000", position: [0, 0, 0] as [number, number, number] },
      { url: "/b.stl", color: "#00ff00", position: [1, 0, 0] as [number, number, number] },
    ];
    mockUseLoader.mockReturnValue([makeGeometry(), makeGeometry()]);
    render(<StlAssemblyViewer parts={parts} label="Assembly" />);
    expect(screen.getByText("Assembly")).toBeInTheDocument();
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });

  it("handles single geometry (non-array) from useLoader", () => {
    const parts = [{ url: "/a.stl" }];
    mockUseLoader.mockReturnValue(makeGeometry());
    render(<StlAssemblyViewer parts={parts} label="Single" />);
    expect(screen.getByText("Single")).toBeInTheDocument();
  });

  it("hides label in compact mode", () => {
    const parts = [{ url: "/a.stl" }];
    mockUseLoader.mockReturnValue(makeGeometry());
    render(<StlAssemblyViewer parts={parts} label="Hidden" compact />);
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });

  it("hides label when label is empty", () => {
    const parts = [{ url: "/a.stl" }];
    mockUseLoader.mockReturnValue(makeGeometry());
    const { container } = render(<StlAssemblyViewer parts={parts} label="" />);
    expect(container.querySelector(".border-t")).toBeNull();
  });

  it("applies rotation when provided", () => {
    const parts = [{ url: "/a.stl" }];
    mockUseLoader.mockReturnValue(makeGeometry());
    render(<StlAssemblyViewer parts={parts} label="" rotation={[45, 90, 0]} />);
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });

  it("defaults position to [0,0,0] when not provided", () => {
    const parts = [{ url: "/a.stl" }, { url: "/b.stl" }];
    mockUseLoader.mockReturnValue([makeGeometry(), makeGeometry()]);
    render(<StlAssemblyViewer parts={parts} label="No Pos" />);
    expect(screen.getByText("No Pos")).toBeInTheDocument();
  });

  it("handles zero-dimension assembly geometry", () => {
    const parts = [{ url: "/a.stl" }];
    const zeroBounds = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
    mockUseLoader.mockReturnValue(makeGeometry(zeroBounds));
    render(<StlAssemblyViewer parts={parts} label="Zero Assembly" />);
    expect(screen.getByText("Zero Assembly")).toBeInTheDocument();
  });

  it("defaults color to gray when not provided", () => {
    const parts = [{ url: "/a.stl" }];
    mockUseLoader.mockReturnValue(makeGeometry());
    render(<StlAssemblyViewer parts={parts} label="Default Color" />);
    expect(screen.getByText("Default Color")).toBeInTheDocument();
  });
});
