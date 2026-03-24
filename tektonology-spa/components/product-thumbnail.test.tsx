import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { Product } from "@/data/types";

vi.mock("@/components/stl-viewer", () => ({
  StlViewer: ({ url, label }: { url: string; label: string }) => (
    <div data-testid="stl-viewer" data-url={url}>{label}</div>
  ),
  StlAssemblyViewer: ({ parts, label, compact }: { parts: unknown[]; label: string; compact?: boolean }) => (
    <div data-testid="stl-assembly-viewer" data-compact={compact ? "true" : "false"}>{label}</div>
  ),
}));

import { ProductThumbnail } from "./product-thumbnail";

afterEach(cleanup);

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: "test",
  name: "Test Product",
  category: "Furniture",
  description: "A test product",
  printSettings: {},
  assemblyGuide: [],
  stlDownloadUrls: [{ label: "Part", url: "/part.stl" }],
  purchaseLinks: [],
  ...overrides,
});

describe("ProductThumbnail", () => {
  it("renders assembly viewer when product has assemblyView", () => {
    const product = makeProduct({
      assemblyView: {
        label: "Assembly",
        parts: [{ url: "/a.stl", color: "#ff0000" }],
        rotation: [90, 0, 0],
      },
    });
    const { container } = render(<ProductThumbnail product={product} />);
    expect(container.querySelector("[data-testid='stl-assembly-viewer']")).toBeInTheDocument();
  });

  it("renders single STL viewer when no assemblyView but has STL download", () => {
    const product = makeProduct({
      stlDownloadUrls: [{ label: "Boot", url: "/boot.stl" }],
    });
    const { container } = render(<ProductThumbnail product={product} />);
    expect(container.querySelector("[data-testid='stl-viewer']")).toBeInTheDocument();
    expect(container.querySelector("[data-testid='stl-viewer']")).toHaveAttribute("data-url", "/boot.stl");
  });

  it("returns null when no assemblyView and no STL downloads", () => {
    const product = makeProduct({
      stlDownloadUrls: [{ label: "PDF Guide", url: "/guide.pdf" }],
    });
    const { container } = render(<ProductThumbnail product={product} />);
    expect(container.querySelector("[data-testid='stl-viewer']")).toBeNull();
    expect(container.querySelector("[data-testid='stl-assembly-viewer']")).toBeNull();
  });
});
