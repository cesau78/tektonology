import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { Product, Batch } from "@/data/types";

const mockReaddirSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockNotFound = vi.fn();

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
  assemblyGuide: ["Print the part", "Sand edges"],
  stlDownloadUrls: [{ label: "Boot STL", url: "/boot.stl" }],
  purchaseLinks: [{ label: "Etsy", url: "https://etsy.com/boot" }],
  ...overrides,
});

const makeBatch = (overrides: Partial<Batch> = {}): Batch => ({
  id: "batch-001",
  productId: "kneeler-boot",
  printedDate: "2025-01-15",
  notes: "First production batch",
  quantity: 10,
  ...overrides,
});

describe("BatchPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.resetModules();
    mockReaddirSync.mockReset();
    mockReadFileSync.mockReset();
    mockNotFound.mockReset();
  });

  it("renders batch details with product info", async () => {
    const product = makeProduct();
    const batch = makeBatch();

    mockReadFileSync.mockReturnValueOnce(JSON.stringify(product));
    mockReaddirSync.mockReturnValue(["batch-001.json"]);
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(batch));

    const { default: BatchPage } = await import("./page");
    const { container } = render(await BatchPage({ params: Promise.resolve({ product: "kneeler-boot", batch: "batch-001" }) }));

    expect(container.querySelector("h1")).toHaveTextContent("Kneeler Boot");
    expect(container).toHaveTextContent("Furniture");
    expect(container).toHaveTextContent("Batch batch-001 — printed 2025-01-15");
  });

  it("renders breadcrumb navigation", async () => {
    const product = makeProduct();
    const batch = makeBatch();

    mockReadFileSync.mockReturnValueOnce(JSON.stringify(product));
    mockReaddirSync.mockReturnValue(["batch-001.json"]);
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(batch));

    const { default: BatchPage } = await import("./page");
    const { container } = render(await BatchPage({ params: Promise.resolve({ product: "kneeler-boot", batch: "batch-001" }) }));

    const nav = container.querySelector("nav")!;
    const productsLink = nav.querySelector('a[href="/"]');
    expect(productsLink).toHaveTextContent("Products");

    const productLink = nav.querySelector('a[href="/products/kneeler-boot"]');
    expect(productLink).toHaveTextContent("Kneeler Boot");

    expect(nav).toHaveTextContent("Batch batch-001");
  });

  it("renders batch info card with all fields", async () => {
    const product = makeProduct();
    const batch = makeBatch({ id: "batch-001", printedDate: "2025-01-15", quantity: 10, notes: "First production batch" });

    mockReadFileSync.mockReturnValueOnce(JSON.stringify(product));
    mockReaddirSync.mockReturnValue(["batch-001.json"]);
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(batch));

    const { default: BatchPage } = await import("./page");
    const { container } = render(await BatchPage({ params: Promise.resolve({ product: "kneeler-boot", batch: "batch-001" }) }));

    expect(container).toHaveTextContent("Batch Info");
    expect(container).toHaveTextContent("Batch ID");
    expect(container).toHaveTextContent("Printed");
    expect(container).toHaveTextContent("Quantity");
    expect(container).toHaveTextContent("10");
    expect(container).toHaveTextContent("Notes");
    expect(container).toHaveTextContent("First production batch");
  });

  it("does not render notes when notes is empty string", async () => {
    const product = makeProduct();
    const batch = makeBatch({ notes: "" });

    mockReadFileSync.mockReturnValueOnce(JSON.stringify(product));
    mockReaddirSync.mockReturnValue(["batch-001.json"]);
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(batch));

    const { default: BatchPage } = await import("./page");
    const { container } = render(await BatchPage({ params: Promise.resolve({ product: "kneeler-boot", batch: "batch-001" }) }));

    const dtElements = container.querySelectorAll("dt");
    const hasNotes = Array.from(dtElements).some((dt) => dt.textContent === "Notes");
    expect(hasNotes).toBe(false);
  });

  it("renders print settings with camelCase labels", async () => {
    const product = makeProduct({
      printSettings: { layerHeight: "0.2mm", infillDensity: "20%" },
    });
    const batch = makeBatch();

    mockReadFileSync.mockReturnValueOnce(JSON.stringify(product));
    mockReaddirSync.mockReturnValue(["batch-001.json"]);
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(batch));

    const { default: BatchPage } = await import("./page");
    const { container } = render(await BatchPage({ params: Promise.resolve({ product: "kneeler-boot", batch: "batch-001" }) }));

    expect(container).toHaveTextContent("Layer Height");
    expect(container).toHaveTextContent("0.2mm");
    expect(container).toHaveTextContent("Infill Density");
    expect(container).toHaveTextContent("20%");
  });

  it("renders assembly guide steps", async () => {
    const product = makeProduct({
      assemblyGuide: ["Print the part", "Sand edges"],
    });
    const batch = makeBatch();

    mockReadFileSync.mockReturnValueOnce(JSON.stringify(product));
    mockReaddirSync.mockReturnValue(["batch-001.json"]);
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(batch));

    const { default: BatchPage } = await import("./page");
    const { container } = render(await BatchPage({ params: Promise.resolve({ product: "kneeler-boot", batch: "batch-001" }) }));

    expect(container).toHaveTextContent("Assembly Guide");
    expect(container).toHaveTextContent("Print the part");
    expect(container).toHaveTextContent("Sand edges");
  });

  it("renders download links", async () => {
    const product = makeProduct({
      stlDownloadUrls: [{ label: "Boot STL", url: "/boot.stl" }],
    });
    const batch = makeBatch();

    mockReadFileSync.mockReturnValueOnce(JSON.stringify(product));
    mockReaddirSync.mockReturnValue(["batch-001.json"]);
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(batch));

    const { default: BatchPage } = await import("./page");
    const { container } = render(await BatchPage({ params: Promise.resolve({ product: "kneeler-boot", batch: "batch-001" }) }));

    expect(container).toHaveTextContent("Downloads");
    const link = container.querySelector('a[href="/boot.stl"]');
    expect(link).toHaveTextContent("Boot STL");
  });

  it("renders purchase links when present", async () => {
    const product = makeProduct({
      purchaseLinks: [{ label: "Etsy", url: "https://etsy.com/boot" }],
    });
    const batch = makeBatch();

    mockReadFileSync.mockReturnValueOnce(JSON.stringify(product));
    mockReaddirSync.mockReturnValue(["batch-001.json"]);
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(batch));

    const { default: BatchPage } = await import("./page");
    const { container } = render(await BatchPage({ params: Promise.resolve({ product: "kneeler-boot", batch: "batch-001" }) }));

    expect(container).toHaveTextContent("Where to Buy");
    const link = container.querySelector('a[href="https://etsy.com/boot"]');
    expect(link).toHaveTextContent("Etsy");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("does not render purchase links when array is empty", async () => {
    const product = makeProduct({ purchaseLinks: [] });
    const batch = makeBatch();

    mockReadFileSync.mockReturnValueOnce(JSON.stringify(product));
    mockReaddirSync.mockReturnValue(["batch-001.json"]);
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(batch));

    const { default: BatchPage } = await import("./page");
    const { container } = render(await BatchPage({ params: Promise.resolve({ product: "kneeler-boot", batch: "batch-001" }) }));

    expect(container).not.toHaveTextContent("Where to Buy");
  });

  it("calls notFound when product does not exist", async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    mockReaddirSync.mockReturnValue([]);
    mockNotFound.mockImplementation(() => { throw new Error("NEXT_NOT_FOUND"); });

    const { default: BatchPage } = await import("./page");
    await expect(BatchPage({ params: Promise.resolve({ product: "nonexistent", batch: "batch-001" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("calls notFound when batch does not exist", async () => {
    const product = makeProduct();
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(product));
    mockReaddirSync.mockReturnValue([]);
    mockNotFound.mockImplementation(() => { throw new Error("NEXT_NOT_FOUND"); });

    const { default: BatchPage } = await import("./page");
    await expect(BatchPage({ params: Promise.resolve({ product: "kneeler-boot", batch: "nonexistent" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("calls notFound when product is null and batch exists", async () => {
    const batch = makeBatch();
    mockReadFileSync
      .mockImplementationOnce(() => { throw new Error("ENOENT"); });
    mockReaddirSync.mockReturnValue(["batch-001.json"]);
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(batch));
    mockNotFound.mockImplementation(() => { throw new Error("NEXT_NOT_FOUND"); });

    const { default: BatchPage } = await import("./page");
    await expect(BatchPage({ params: Promise.resolve({ product: "nonexistent", batch: "batch-001" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("filters non-json files from batch directory", async () => {
    const product = makeProduct();
    const batch = makeBatch();

    mockReadFileSync.mockReturnValueOnce(JSON.stringify(product));
    mockReaddirSync.mockReturnValue(["batch-001.json", ".gitkeep", "notes.md"]);
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(batch));

    const { default: BatchPage } = await import("./page");
    render(await BatchPage({ params: Promise.resolve({ product: "kneeler-boot", batch: "batch-001" }) }));

    // product read + 1 batch json only
    expect(mockReadFileSync).toHaveBeenCalledTimes(2);
  });

  it("returns null when batch does not match product and batch IDs", async () => {
    const product = makeProduct();
    const otherBatch = makeBatch({ id: "batch-002", productId: "other-product" });

    mockReadFileSync.mockReturnValueOnce(JSON.stringify(product));
    mockReaddirSync.mockReturnValue(["batch-002.json"]);
    mockReadFileSync.mockReturnValueOnce(JSON.stringify(otherBatch));
    mockNotFound.mockImplementation(() => { throw new Error("NEXT_NOT_FOUND"); });

    const { default: BatchPage } = await import("./page");
    await expect(BatchPage({ params: Promise.resolve({ product: "kneeler-boot", batch: "batch-001" }) })).rejects.toThrow("NEXT_NOT_FOUND");
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

  it("returns params for each batch json file", async () => {
    const batch1 = makeBatch({ id: "batch-001", productId: "kneeler-boot" });
    const batch2 = makeBatch({ id: "batch-002", productId: "kneeler-bushing" });

    mockReaddirSync.mockReturnValue(["batch-001.json", "batch-002.json"]);
    mockReadFileSync
      .mockReturnValueOnce(JSON.stringify(batch1))
      .mockReturnValueOnce(JSON.stringify(batch2));

    const { generateStaticParams } = await import("./page");
    const params = await generateStaticParams();

    expect(params).toEqual([
      { product: "kneeler-boot", batch: "batch-001" },
      { product: "kneeler-bushing", batch: "batch-002" },
    ]);
  });

  it("filters out non-json files", async () => {
    const batch = makeBatch({ id: "batch-001", productId: "kneeler-boot" });

    mockReaddirSync.mockReturnValue(["batch-001.json", "readme.txt"]);
    mockReadFileSync.mockReturnValue(JSON.stringify(batch));

    const { generateStaticParams } = await import("./page");
    const params = await generateStaticParams();

    expect(params).toEqual([{ product: "kneeler-boot", batch: "batch-001" }]);
    expect(mockReadFileSync).toHaveBeenCalledTimes(1);
  });

  it("returns empty array when no batches exist", async () => {
    mockReaddirSync.mockReturnValue([]);

    const { generateStaticParams } = await import("./page");
    const params = await generateStaticParams();

    expect(params).toEqual([]);
  });
});
