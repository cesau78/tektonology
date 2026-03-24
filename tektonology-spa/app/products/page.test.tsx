import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { Product } from "@/data/types";

afterEach(cleanup);

const mockReaddirSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock("@/components/product-thumbnail", () => ({
  ProductThumbnail: () => <div data-testid="product-thumbnail" />,
}));

vi.mock("fs", () => ({
  default: {
    readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  },
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: "test-product",
  name: "Test Product",
  category: "Furniture",
  description: "A test product",
  printSettings: { layerHeight: "0.2mm" },
  assemblyGuide: ["Step 1"],
  stlDownloadUrls: [{ label: "STL", url: "/test.stl" }],
  purchaseLinks: [],
  ...overrides,
});

describe("ProductsPage", () => {
  beforeEach(() => {
    vi.resetModules();
    mockReaddirSync.mockReset();
    mockReadFileSync.mockReset();
  });

  it("renders products grouped by category", async () => {
    const productA = makeProduct({ id: "a", name: "Alpha", category: "Furniture" });
    const productB = makeProduct({ id: "b", name: "Beta", category: "Pest Control" });

    mockReaddirSync.mockReturnValue(["a.json", "b.json"]);
    mockReadFileSync
      .mockReturnValueOnce(JSON.stringify(productA))
      .mockReturnValueOnce(JSON.stringify(productB));

    const { default: ProductsPage } = await import("./page");
    const { container } = render(<ProductsPage />);

    expect(container).toHaveTextContent("Products");
    expect(container).toHaveTextContent("Alpha");
    expect(container).toHaveTextContent("Beta");
    expect(container).toHaveTextContent("Furniture");
    expect(container).toHaveTextContent("Pest Control");
  });

  it("renders product links with correct hrefs", async () => {
    const product = makeProduct({ id: "kneeler-boot", name: "Kneeler Boot" });

    mockReaddirSync.mockReturnValue(["kneeler-boot.json"]);
    mockReadFileSync.mockReturnValue(JSON.stringify(product));

    const { default: ProductsPage } = await import("./page");
    const { container } = render(<ProductsPage />);

    const link = container.querySelector("a[href='/products/kneeler-boot']");
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent("Kneeler Boot");
  });

  it("renders product description", async () => {
    const product = makeProduct({ description: "Boot for kneeler pews" });

    mockReaddirSync.mockReturnValue(["test.json"]);
    mockReadFileSync.mockReturnValue(JSON.stringify(product));

    const { default: ProductsPage } = await import("./page");
    const { container } = render(<ProductsPage />);

    expect(container).toHaveTextContent("Boot for kneeler pews");
  });

  it("filters non-json files from directory listing", async () => {
    const product = makeProduct();

    mockReaddirSync.mockReturnValue(["test-product.json", "readme.txt", ".DS_Store"]);
    mockReadFileSync.mockReturnValue(JSON.stringify(product));

    const { default: ProductsPage } = await import("./page");
    render(<ProductsPage />);

    expect(mockReadFileSync).toHaveBeenCalledTimes(1);
  });

  it("renders empty state with no products", async () => {
    mockReaddirSync.mockReturnValue([]);

    const { default: ProductsPage } = await import("./page");
    const { container } = render(<ProductsPage />);

    expect(container).toHaveTextContent("Products");
    expect(container.querySelector("a")).toBeNull();
  });

  it("sorts products by name within a category", async () => {
    const productC = makeProduct({ id: "c", name: "Charlie", category: "Furniture" });
    const productA = makeProduct({ id: "a", name: "Alpha", category: "Furniture" });

    mockReaddirSync.mockReturnValue(["c.json", "a.json"]);
    mockReadFileSync
      .mockReturnValueOnce(JSON.stringify(productC))
      .mockReturnValueOnce(JSON.stringify(productA));

    const { default: ProductsPage } = await import("./page");
    const { container } = render(<ProductsPage />);

    const links = container.querySelectorAll("a");
    expect(links[0]).toHaveTextContent("Alpha");
    expect(links[1]).toHaveTextContent("Charlie");
  });

  it("sorts Tools category last", async () => {
    const productA = makeProduct({ id: "a", name: "Alpha", category: "Furniture" });
    const productB = makeProduct({ id: "b", name: "Beta", category: "Tools" });
    const productC = makeProduct({ id: "c", name: "Charlie", category: "Pest Control" });

    mockReaddirSync.mockReturnValue(["a.json", "b.json", "c.json"]);
    mockReadFileSync
      .mockReturnValueOnce(JSON.stringify(productA))
      .mockReturnValueOnce(JSON.stringify(productB))
      .mockReturnValueOnce(JSON.stringify(productC));

    const { default: ProductsPage } = await import("./page");
    const { container } = render(<ProductsPage />);

    const allText = container.textContent || "";
    const furnitureIdx = allText.indexOf("Furniture");
    const pestIdx = allText.indexOf("Pest Control");
    const toolsIdx = allText.indexOf("Tools");
    expect(furnitureIdx).toBeLessThan(toolsIdx);
    expect(pestIdx).toBeLessThan(toolsIdx);
  });

  it("groups multiple products under the same category", async () => {
    const productA = makeProduct({ id: "a", name: "Alpha", category: "Furniture" });
    const productB = makeProduct({ id: "b", name: "Beta", category: "Furniture" });

    mockReaddirSync.mockReturnValue(["a.json", "b.json"]);
    mockReadFileSync
      .mockReturnValueOnce(JSON.stringify(productA))
      .mockReturnValueOnce(JSON.stringify(productB));

    const { default: ProductsPage } = await import("./page");
    const { container } = render(<ProductsPage />);

    const allText = container.textContent || "";
    const furnitureMatches = allText.split("Furniture").length - 1;
    expect(furnitureMatches).toBe(1);
    expect(container).toHaveTextContent("Alpha");
    expect(container).toHaveTextContent("Beta");
  });
});
