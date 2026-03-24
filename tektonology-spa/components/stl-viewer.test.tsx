import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas">{children}</div>
  ),
  useLoader: vi.fn(() => {
    const geom = {
      computeBoundingBox: vi.fn(),
      center: vi.fn(() => geom),
      boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
    };
    return geom;
  }),
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

import { StlViewer } from "./stl-viewer";

afterEach(cleanup);

describe("StlViewer", () => {
  it("renders with the label", () => {
    render(<StlViewer url="/test.stl" label="Test Part" />);
    expect(screen.getByText("Test Part")).toBeInTheDocument();
  });

  it("renders the canvas container", () => {
    render(<StlViewer url="/test.stl" label="Test Part" />);
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });
});
