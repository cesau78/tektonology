import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { Product } from "@/data/types";

const mockReaddirSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockNotFound = vi.fn();

vi.mock("@/components/stl-viewer", () => ({
  StlViewer: ({ url, label }: { url: string; label: string }) => (
    <div data-testid="stl-viewer" data-url={url}>{label}</div>
  ),
  StlAssemblyViewer: ({ label }: { label: string }) => (
    <div data-testid="stl-assembly-viewer">{label}</div>
  ),
}));

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

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: "kneeler-boot",
  name: "Kneeler Boot",
  category: "Furniture",
  description: "Replacement boot for pew kneelers",
  printSettings: { layerHeight: "0.2mm", infillDensity: "20%" },
  assemblyGuide: ["Print the part", "Sand edges", "Install on kneeler"],
  stlDownloadUrls: [{ label: "Boot STL", url: "/boot.stl" }],
  purchaseLinks: [{ label: "Etsy", url: "https://etsy.com/boot" }],
  ...overrides,
});

describe("ProductPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.resetModules();
    mockReaddirSync.mockReset();
    mockReadFileSync.mockReset();
    mockNotFound.mockReset();
  });

  it("renders product details", async () => {
    const product = makeProduct();
    mockReadFileSync.mockReturnValue(JSON.stringify(product));
    mockReaddirSync.mockReturnValue([]);

    const { default: ProductPage } = await import("./page");
    const { container } = render(await ProductPage({ params: Promise.resolve({ product: "kneeler-boot" }) }));

    expect(container.querySelector("h1")).toHaveTextContent("Kneeler Boot");
    expect(container).toHaveTextContent("Furniture");
    expect(container).toHaveTextContent("Replacement boot for pew kneelers");
  });

  it("renders breadcrumb with link to products", async () => {
    const product = makeProduct();
    mockReadFileSync.mockReturnValue(JSON.stringify(product));
    mockReaddirSync.mockReturnValue([]);

    const { default: ProductPage } = await import("./page");
    const { container } = render(await ProductPage({ params: Promise.resolve({ product: "kneeler-boot" }) }));

    const nav = container.querySelector("nav")!;
    const productsLink = nav.querySelector('a[href="/products"]');
    expect(productsLink).toHaveTextContent("Products");
  });

  it("renders download links", async () => {
    const product = makeProduct({
      stlDownloadUrls: [{ label: "Boot STL", url: "/boot.stl" }],
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(product));
    mockReaddirSync.mockReturnValue([]);

    const { default: ProductPage } = await import("./page");
    const { container } = render(await ProductPage({ params: Promise.resolve({ product: "kneeler-boot" }) }));

    const link = container.querySelector('a[href="/boot.stl"]');
    expect(link).toHaveTextContent("Boot STL");
  });

  it("renders assembly viewer when product has assemblyView", async () => {
    const product = makeProduct({
      assemblyView: {
        label: "Full Assembly",
        parts: [{ url: "/a.stl", color: "#ff0000" }],
        rotation: [90, 0, 0],
      },
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(product));
    mockReaddirSync.mockReturnValue([]);

    const { default: ProductPage } = await import("./page");
    const { container } = render(await ProductPage({ params: Promise.resolve({ product: "kneeler-boot" }) }));

    expect(container.querySelector("[data-testid='stl-assembly-viewer']")).toHaveTextContent("Full Assembly");
  });

  it("renders two-column grid for two STL downloads", async () => {
    const product = makeProduct({
      stlDownloadUrls: [
        { label: "Part A", url: "/a.stl" },
        { label: "Part B", url: "/b.stl" },
      ],
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(product));
    mockReaddirSync.mockReturnValue([]);

    const { default: ProductPage } = await import("./page");
    const { container } = render(await ProductPage({ params: Promise.resolve({ product: "kneeler-boot" }) }));

    const grid = container.querySelector(".grid-cols-2");
    expect(grid).toBeInTheDocument();
  });

  it("renders three-column grid for three or more STL downloads", async () => {
    const product = makeProduct({
      stlDownloadUrls: [
        { label: "Part A", url: "/a.stl" },
        { label: "Part B", url: "/b.stl" },
        { label: "Part C", url: "/c.stl" },
      ],
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(product));
    mockReaddirSync.mockReturnValue([]);

    const { default: ProductPage } = await import("./page");
    const { container } = render(await ProductPage({ params: Promise.resolve({ product: "kneeler-boot" }) }));

    const grid = container.querySelector(".grid-cols-3");
    expect(grid).toBeInTheDocument();
  });

  it("does not render stl viewer for non-stl download", async () => {
    const product = makeProduct({
      stlDownloadUrls: [{ label: "PDF Guide", url: "/guide.pdf" }],
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(product));
    mockReaddirSync.mockReturnValue([]);

    const { default: ProductPage } = await import("./page");
    const { container } = render(await ProductPage({ params: Promise.resolve({ product: "kneeler-boot" }) }));

    expect(container.querySelector("[data-testid='stl-viewer']")).toBeNull();
  });

  it("renders purchase links when present", async () => {
    const product = makeProduct({
      purchaseLinks: [{ label: "Etsy", url: "https://etsy.com/boot" }],
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(product));
    mockReaddirSync.mockReturnValue([]);

    const { default: ProductPage } = await import("./page");
    const { container } = render(await ProductPage({ params: Promise.resolve({ product: "kneeler-boot" }) }));

    expect(container).toHaveTextContent("Where to Buy");
    const link = container.querySelector('a[href="https://etsy.com/boot"]');
    expect(link).toHaveTextContent("Etsy");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("does not render purchase links section when array is empty", async () => {
    const product = makeProduct({ purchaseLinks: [] });
    mockReadFileSync.mockReturnValue(JSON.stringify(product));
    mockReaddirSync.mockReturnValue([]);

    const { default: ProductPage } = await import("./page");
    const { container } = render(await ProductPage({ params: Promise.resolve({ product: "kneeler-boot" }) }));

    expect(container).not.toHaveTextContent("Where to Buy");
  });

  it("calls notFound when product does not exist", async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    mockReaddirSync.mockReturnValue([]);
    mockNotFound.mockImplementation(() => { throw new Error("NEXT_NOT_FOUND"); });

    const { default: ProductPage } = await import("./page");
    await expect(ProductPage({ params: Promise.resolve({ product: "nonexistent" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });
});

describe("generateStaticParams", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.resetModules();
    mockReaddirSync.mockReset();
    mockReadFileSync.mockReset();
  });

  it("returns params for each product json file", async () => {
    mockReaddirSync.mockReturnValue(["kneeler-boot.json", "kneeler-bushing.json"]);

    const { generateStaticParams } = await import("./page");
    const params = await generateStaticParams();

    expect(params).toEqual([
      { product: "kneeler-boot" },
      { product: "kneeler-bushing" },
    ]);
  });

  it("filters out non-json files", async () => {
    mockReaddirSync.mockReturnValue(["kneeler-boot.json", "readme.txt"]);

    const { generateStaticParams } = await import("./page");
    const params = await generateStaticParams();

    expect(params).toEqual([{ product: "kneeler-boot" }]);
  });

  it("returns empty array when no products exist", async () => {
    mockReaddirSync.mockReturnValue([]);

    const { generateStaticParams } = await import("./page");
    const params = await generateStaticParams();

    expect(params).toEqual([]);
  });
});
