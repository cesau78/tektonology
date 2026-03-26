import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor, within, fireEvent, act } from "@testing-library/react";

const mockApiFetch = vi.fn();

vi.mock("@auth0/auth0-react", () => ({
  useAuth0: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: {
      email_verified: true,
      "https://tektonology.com/role": "owner",
    },
    getAccessTokenSilently: vi.fn().mockResolvedValue("token"),
    loginWithRedirect: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/auth", () => ({
  useRole: () => ({ role: "owner", isLoaded: true }),
  canAccessFinance: () => true,
  canWrite: () => true,
  isAuthenticated: () => true,
}));

vi.mock("@/lib/api", () => ({
  useApiFetch: () => mockApiFetch,
}));

import HardwarePage from "./page";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: hardware list fetch resolves with sample data; journal fetch resolves with empty array
  mockApiFetch.mockImplementation((url: string) => {
    if (url === "/api/finance/journal") return Promise.resolve([]);
    return new Promise(() => {}); // hang by default so each test sets up its own
  });
});

const sampleHardware = [
  {
    hardwareId: 1,
    supplier: "McMaster-Carr",
    supplierId: null,
    item: "Hex Bolt",
    dimensions: "M5x20",
    material: "Steel",
    effective: "2025-06-01",
    baseCost: 10.0,
    taxes: 1.5,
    shipping: 1.0,
    cost: 12.50,
    quantity: 100,
    remaining: 85,
  },
  {
    hardwareId: 2,
    supplier: "Fastenal",
    supplierId: "FAS-123",
    item: "Lock Nut",
    dimensions: "M5",
    material: "Zinc",
    effective: "2025-06-15",
    baseCost: 6.0,
    taxes: 1.0,
    shipping: 1.0,
    cost: 8.00,
    quantity: 200,
    remaining: 150,
    journalId: 42,
  },
  {
    hardwareId: 3,
    supplier: "Amazon",
    supplierId: null,
    item: "Allen Wrench",
    dimensions: "4mm",
    material: "Chrome Vanadium",
    effective: "2025-07-01",
    baseCost: 4.0,
    taxes: 0.99,
    shipping: 1.0,
    cost: 5.99,
    quantity: 0,
    remaining: 0,
  },
];

/** Helper: set up mockApiFetch to return sampleHardware for the list endpoint and [] for journal */
function setupDefaultFetch(data = sampleHardware) {
  mockApiFetch.mockImplementation((url: string) => {
    if (url === "/api/finance/journal") return Promise.resolve([]);
    if (typeof url === "string" && url.startsWith("/api/procurement/hardware")) return Promise.resolve(data);
    return Promise.resolve(data);
  });
}

/** Helper to fill the add/edit form's "Total Cost", "Quantity", and "Remaining" fields */
function fillCostQtyRemaining(container: HTMLElement, cost: string, qty: string, rem: string) {
  const costInputs = container.querySelectorAll("input[placeholder='0.00']");
  // 0=Base Cost, 1=Taxes, 2=Shipping, 3=Total Cost
  fireEvent.change(costInputs[3]!, { target: { value: cost } });
  const numInputs = container.querySelectorAll("input[placeholder='0']");
  fireEvent.change(numInputs[0]!, { target: { value: qty } });
  fireEvent.change(numInputs[1]!, { target: { value: rem } });
}

describe("HardwarePage", () => {
  it("shows loading state initially", () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/api/finance/journal") return Promise.resolve([]);
      return new Promise(() => {});
    });
    const { container } = render(<HardwarePage />);
    expect(container.textContent).toContain("Loading...");
  });

  it("shows error state on fetch failure", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/api/finance/journal") return Promise.resolve([]);
      return Promise.reject(new Error("Server error"));
    });
    const { container } = render(<HardwarePage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Server error");
    });
  });

  it("renders hardware table with data", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Hex Bolt");
    });
    expect(container.textContent).toContain("Lock Nut");
    expect(container.textContent).toContain("Allen Wrench");
  });

  it("renders breadcrumb navigation", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => {
      expect(container.querySelector("a[href='/']")?.textContent).toBe("Home");
    });
    expect(container.querySelector("a[href='/procurement']")?.textContent).toBe("Procurement");
    expect(container.querySelector("nav span.text-foreground")?.textContent).toBe("Hardware Inventory");
  });

  it("shows summary with total pieces and cost", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => {
      expect(container.textContent).toContain("235 pieces on hand");
    });
    expect(container.textContent).toContain("$26.49 invested");
  });

  it("renders all table columns", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => {
      expect(container.textContent).toContain("McMaster-Carr");
    });
    expect(container.textContent).toContain("Fastenal");
    expect(container.textContent).toContain("M5x20");
    expect(container.textContent).toContain("M5");
    expect(container.textContent).toContain("4mm");
  });

  it("calculates unit cost correctly", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => {
      // Unit cost for Hex Bolt: 12.50 / 100 = $0.13
      expect(container.textContent).toContain("$0.13");
    });
    // Unit cost for Lock Nut: 8.00 / 200 = $0.04
    expect(container.textContent).toContain("$0.04");
  });

  it("handles zero quantity (unit cost = 0)", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => {
      // Allen Wrench: quantity 0, unitCost = 0 => "$0.00"
      expect(container.textContent).toContain("$0.00");
    });
  });

  it("renders quantity and remaining columns", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => {
      expect(container.textContent).toContain("100");
    });
    expect(container.textContent).toContain("85");
    expect(container.textContent).toContain("200");
    expect(container.textContent).toContain("150");
  });

  it("renders journal column with IDs and dashes", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => {
      expect(container.textContent).toContain("#42");
    });
    // Items without journalId show em-dash
    expect(container.textContent).toContain("—");
  });

  // ── Add Row ──────────────────────────────────────────────────────────

  it("opens add form and cancels", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Hex Bolt");
    });
    const addBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "+ Add Hardware")!;
    await act(async () => { fireEvent.click(addBtn); });
    expect(container.querySelector("input[placeholder='e.g. M3x20 Socket Cap Bolt']")).toBeTruthy();
    const cancelBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Cancel")!;
    await act(async () => { fireEvent.click(cancelBtn); });
    expect(container.querySelector("input[placeholder='e.g. M3x20 Socket Cap Bolt']")).toBeFalsy();
  });

  it("adds hardware successfully", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Hex Bolt");
    });
    const addBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "+ Add Hardware")!;
    await act(async () => { fireEvent.click(addBtn); });
    fireEvent.change(container.querySelector("input[placeholder='e.g. M3x20 Socket Cap Bolt']")!, { target: { value: "Cap Screw" } });
    fireEvent.change(container.querySelector("input[placeholder='e.g. Bolt Depot']")!, { target: { value: "Grainger" } });
    fireEvent.change(container.querySelector("input[placeholder='e.g. 3x0.5x20mm']")!, { target: { value: "M6x25" } });
    fillCostQtyRemaining(container, "3.50", "50", "50");
    mockApiFetch.mockResolvedValueOnce(undefined);
    mockApiFetch.mockResolvedValueOnce(sampleHardware);
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
    await act(async () => { fireEvent.click(saveBtn); });
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/procurement/hardware", expect.objectContaining({ method: "POST" }));
    });
  });

  it("shows validation error for empty item on add", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const addBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "+ Add Hardware")!;
    await act(async () => { fireEvent.click(addBtn); });
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
    await act(async () => { fireEvent.click(saveBtn); });
    expect(container.textContent).toContain("Item name is required");
  });

  it("shows validation error for empty supplier on add", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const addBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "+ Add Hardware")!;
    await act(async () => { fireEvent.click(addBtn); });
    fireEvent.change(container.querySelector("input[placeholder='e.g. M3x20 Socket Cap Bolt']")!, { target: { value: "Bolt" } });
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
    await act(async () => { fireEvent.click(saveBtn); });
    expect(container.textContent).toContain("Supplier is required");
  });

  it("shows validation error for NaN cost on add", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const addBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "+ Add Hardware")!;
    await act(async () => { fireEvent.click(addBtn); });
    fireEvent.change(container.querySelector("input[placeholder='e.g. M3x20 Socket Cap Bolt']")!, { target: { value: "Bolt" } });
    fireEvent.change(container.querySelector("input[placeholder='e.g. Bolt Depot']")!, { target: { value: "Acme" } });
    const costInputs = container.querySelectorAll("input[placeholder='0.00']");
    fireEvent.change(costInputs[3]!, { target: { value: "abc" } });
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
    await act(async () => { fireEvent.click(saveBtn); });
    expect(container.textContent).toContain("Cost must be a non-negative number");
  });

  it("shows validation error for negative cost on add", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const addBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "+ Add Hardware")!;
    await act(async () => { fireEvent.click(addBtn); });
    fireEvent.change(container.querySelector("input[placeholder='e.g. M3x20 Socket Cap Bolt']")!, { target: { value: "Bolt" } });
    fireEvent.change(container.querySelector("input[placeholder='e.g. Bolt Depot']")!, { target: { value: "Acme" } });
    const costInputs = container.querySelectorAll("input[placeholder='0.00']");
    fireEvent.change(costInputs[3]!, { target: { value: "-5" } });
    const numInputs = container.querySelectorAll("input[placeholder='0']");
    fireEvent.change(numInputs[0]!, { target: { value: "10" } });
    fireEvent.change(numInputs[1]!, { target: { value: "10" } });
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
    await act(async () => { fireEvent.click(saveBtn); });
    expect(container.textContent).toContain("Cost must be a non-negative number");
  });

  it("shows validation error for NaN quantity on add", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const addBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "+ Add Hardware")!;
    await act(async () => { fireEvent.click(addBtn); });
    fireEvent.change(container.querySelector("input[placeholder='e.g. M3x20 Socket Cap Bolt']")!, { target: { value: "Bolt" } });
    fireEvent.change(container.querySelector("input[placeholder='e.g. Bolt Depot']")!, { target: { value: "Acme" } });
    const costInputs = container.querySelectorAll("input[placeholder='0.00']");
    fireEvent.change(costInputs[3]!, { target: { value: "5" } });
    const numInputs = container.querySelectorAll("input[placeholder='0']");
    fireEvent.change(numInputs[0]!, { target: { value: "abc" } });
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
    await act(async () => { fireEvent.click(saveBtn); });
    expect(container.textContent).toContain("Quantity must be a non-negative integer");
  });

  it("shows validation error for NaN remaining on add", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const addBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "+ Add Hardware")!;
    await act(async () => { fireEvent.click(addBtn); });
    fireEvent.change(container.querySelector("input[placeholder='e.g. M3x20 Socket Cap Bolt']")!, { target: { value: "Bolt" } });
    fireEvent.change(container.querySelector("input[placeholder='e.g. Bolt Depot']")!, { target: { value: "Acme" } });
    const costInputs = container.querySelectorAll("input[placeholder='0.00']");
    fireEvent.change(costInputs[3]!, { target: { value: "5" } });
    const numInputs = container.querySelectorAll("input[placeholder='0']");
    fireEvent.change(numInputs[0]!, { target: { value: "10" } });
    fireEvent.change(numInputs[1]!, { target: { value: "abc" } });
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
    await act(async () => { fireEvent.click(saveBtn); });
    expect(container.textContent).toContain("Remaining must be a non-negative integer");
  });

  it("shows error message on add API error (Error)", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const addBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "+ Add Hardware")!;
    await act(async () => { fireEvent.click(addBtn); });
    fireEvent.change(container.querySelector("input[placeholder='e.g. M3x20 Socket Cap Bolt']")!, { target: { value: "Bolt" } });
    fireEvent.change(container.querySelector("input[placeholder='e.g. Bolt Depot']")!, { target: { value: "Acme" } });
    fillCostQtyRemaining(container, "5", "10", "10");
    mockApiFetch.mockRejectedValueOnce(new Error("Add failed badly"));
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
    await act(async () => { fireEvent.click(saveBtn); });
    await waitFor(() => {
      expect(container.textContent).toContain("Add failed badly");
    });
  });

  it("shows fallback message on add API error (non-Error)", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const addBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "+ Add Hardware")!;
    await act(async () => { fireEvent.click(addBtn); });
    fireEvent.change(container.querySelector("input[placeholder='e.g. M3x20 Socket Cap Bolt']")!, { target: { value: "Bolt" } });
    fireEvent.change(container.querySelector("input[placeholder='e.g. Bolt Depot']")!, { target: { value: "Acme" } });
    fillCostQtyRemaining(container, "5", "10", "10");
    mockApiFetch.mockRejectedValueOnce("string error");
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
    await act(async () => { fireEvent.click(saveBtn); });
    await waitFor(() => {
      expect(container.textContent).toContain("Failed to add");
    });
  });

  it("hides add button while adding", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const addBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "+ Add Hardware")!;
    await act(async () => { fireEvent.click(addBtn); });
    const addBtn2 = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "+ Add Hardware");
    expect(addBtn2).toBeFalsy();
  });

  // ── Edit Row ─────────────────────────────────────────────────────────

  it("enters edit mode, shows Save/Cancel, Cancel exits", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const editBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Edit")!;
    await act(async () => { fireEvent.click(editBtn); });
    expect(Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Save")).toBeTruthy();
    expect(Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Cancel")).toBeTruthy();
    const cancelBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Cancel")!;
    await act(async () => { fireEvent.click(cancelBtn); });
    expect(Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Edit")).toBeTruthy();
  });

  it("saves edit via PUT", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const editBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Edit")!;
    await act(async () => { fireEvent.click(editBtn); });
    const inputs = container.querySelectorAll("input");
    const itemInput = Array.from(inputs).find((i) => (i as HTMLInputElement).value === "Hex Bolt")!;
    fireEvent.change(itemInput, { target: { value: "Hex Bolt Updated" } });
    mockApiFetch.mockResolvedValueOnce(undefined);
    mockApiFetch.mockResolvedValueOnce(sampleHardware);
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
    await act(async () => { fireEvent.click(saveBtn); });
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/procurement/hardware/1", expect.objectContaining({ method: "PUT" }));
    });
  });

  it("exercises dimensions onChange in edit mode", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const editBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Edit")!;
    await act(async () => { fireEvent.click(editBtn); });
    const inputs = container.querySelectorAll("input");
    const dimInput = Array.from(inputs).find((i) => (i as HTMLInputElement).value === "M5x20")!;
    fireEvent.change(dimInput, { target: { value: "M6x25" } });
    mockApiFetch.mockResolvedValueOnce(undefined);
    mockApiFetch.mockResolvedValueOnce(sampleHardware);
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
    await act(async () => { fireEvent.click(saveBtn); });
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/procurement/hardware/1", expect.objectContaining({ method: "PUT" }));
    });
  });

  it("shows edit validation error for empty item", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const editBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Edit")!;
    await act(async () => { fireEvent.click(editBtn); });
    const inputs = container.querySelectorAll("input");
    const itemInput = Array.from(inputs).find((i) => (i as HTMLInputElement).value === "Hex Bolt")!;
    fireEvent.change(itemInput, { target: { value: "" } });
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
    await act(async () => { fireEvent.click(saveBtn); });
    expect(container.textContent).toContain("Item name is required");
  });

  it("shows edit validation error for empty supplier", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const editBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Edit")!;
    await act(async () => { fireEvent.click(editBtn); });
    const inputs = container.querySelectorAll("input");
    const supplierInput = Array.from(inputs).find((i) => (i as HTMLInputElement).value === "McMaster-Carr")!;
    fireEvent.change(supplierInput, { target: { value: "" } });
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
    await act(async () => { fireEvent.click(saveBtn); });
    expect(container.textContent).toContain("Supplier is required");
  });

  it("shows edit validation error for NaN cost", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const editBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Edit")!;
    await act(async () => { fireEvent.click(editBtn); });
    const inputs = container.querySelectorAll("input");
    const costInput = Array.from(inputs).find((i) => (i as HTMLInputElement).value === "12.5")!;
    fireEvent.change(costInput, { target: { value: "abc" } });
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
    await act(async () => { fireEvent.click(saveBtn); });
    expect(container.textContent).toContain("Cost must be a non-negative number");
  });

  it("shows edit validation error for NaN quantity", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const editBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Edit")!;
    await act(async () => { fireEvent.click(editBtn); });
    const inputs = container.querySelectorAll("input");
    const qtyInput = Array.from(inputs).find((i) => (i as HTMLInputElement).value === "100")!;
    fireEvent.change(qtyInput, { target: { value: "abc" } });
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
    await act(async () => { fireEvent.click(saveBtn); });
    expect(container.textContent).toContain("Quantity must be a non-negative integer");
  });

  it("shows edit validation error for NaN remaining", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const editBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Edit")!;
    await act(async () => { fireEvent.click(editBtn); });
    const inputs = container.querySelectorAll("input");
    const remInput = Array.from(inputs).find((i) => (i as HTMLInputElement).value === "85")!;
    fireEvent.change(remInput, { target: { value: "abc" } });
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
    await act(async () => { fireEvent.click(saveBtn); });
    expect(container.textContent).toContain("Remaining must be a non-negative integer");
  });

  it("shows error message on edit save error (Error)", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const editBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Edit")!;
    await act(async () => { fireEvent.click(editBtn); });
    mockApiFetch.mockRejectedValueOnce(new Error("Edit exploded"));
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
    await act(async () => { fireEvent.click(saveBtn); });
    await waitFor(() => {
      expect(container.textContent).toContain("Edit exploded");
    });
  });

  it("shows fallback message on edit save error (non-Error)", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const editBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Edit")!;
    await act(async () => { fireEvent.click(editBtn); });
    mockApiFetch.mockRejectedValueOnce(42);
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Save")!;
    await act(async () => { fireEvent.click(saveBtn); });
    await waitFor(() => {
      expect(container.textContent).toContain("Failed to save");
    });
  });

  // ── Inline Delete ────────────────────────────────────────────────────

  it("shows Delete? Yes/No confirmation", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const deleteBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Delete")!;
    await act(async () => { fireEvent.click(deleteBtn); });
    expect(container.textContent).toContain("Delete?");
    expect(Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Yes")).toBeTruthy();
    expect(Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "No")).toBeTruthy();
  });

  it("confirms delete via DELETE request", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const deleteBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Delete")!;
    await act(async () => { fireEvent.click(deleteBtn); });
    mockApiFetch.mockResolvedValueOnce(undefined);
    mockApiFetch.mockResolvedValueOnce(sampleHardware);
    const yesBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Yes")!;
    await act(async () => { fireEvent.click(yesBtn); });
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/procurement/hardware/1", expect.objectContaining({ method: "DELETE" }));
    });
  });

  it("cancels delete on No", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const deleteBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Delete")!;
    await act(async () => { fireEvent.click(deleteBtn); });
    const noBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "No")!;
    await act(async () => { fireEvent.click(noBtn); });
    expect(container.textContent).not.toContain("Delete?");
  });

  it("shows error message on delete error (Error)", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const deleteBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Delete")!;
    await act(async () => { fireEvent.click(deleteBtn); });
    mockApiFetch.mockRejectedValueOnce(new Error("Delete boom"));
    const yesBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Yes")!;
    await act(async () => { fireEvent.click(yesBtn); });
    await waitFor(() => {
      expect(container.textContent).toContain("Delete boom");
    });
  });

  it("shows fallback message on delete error (non-Error)", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    const deleteBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Delete")!;
    await act(async () => { fireEvent.click(deleteBtn); });
    mockApiFetch.mockRejectedValueOnce("nope");
    const yesBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Yes")!;
    await act(async () => { fireEvent.click(yesBtn); });
    await waitFor(() => {
      expect(container.textContent).toContain("Failed to delete");
    });
  });

  // ── Soft Delete Lifecycle ────────────────────────────────────────────

  const sampleHardwareWithDeleted = [
    { hardwareId: 1, supplier: "McMaster-Carr", supplierId: null, item: "Hex Bolt", dimensions: "M5x20", material: "Steel", effective: "2025-06-01", baseCost: 10.0, taxes: 1.5, shipping: 1.0, cost: 12.50, quantity: 100, remaining: 85 },
    { hardwareId: 99, supplier: "OldCo", supplierId: null, item: "Old Part", dimensions: "N/A", material: "", effective: "", baseCost: 5.0, taxes: 0, shipping: 0, cost: 5.00, quantity: 10, remaining: 0, deletedAt: "2025-01-01T00:00:00.000Z" },
  ];

  it("toggles show deleted and fetches with includeDeleted", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    mockApiFetch.mockResolvedValueOnce(sampleHardwareWithDeleted);
    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Show Deleted")!;
    await act(async () => { fireEvent.click(showDeletedBtn); });
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/procurement/hardware?includeDeleted=true");
    });
  });

  it("renders deleted rows with opacity-50 and shows Restore/Purge", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    mockApiFetch.mockResolvedValueOnce(sampleHardwareWithDeleted);
    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Show Deleted")!;
    await act(async () => { fireEvent.click(showDeletedBtn); });
    await waitFor(() => {
      expect(container.textContent).toContain("Old Part");
    });
    const rows = container.querySelectorAll("tbody tr");
    const deletedRow = Array.from(rows).find((r) => r.textContent?.includes("Old Part"))!;
    expect(deletedRow.className).toContain("opacity-50");
    const rowScope = within(deletedRow as HTMLElement);
    expect(rowScope.getByText("Restore")).toBeTruthy();
    expect(rowScope.getByText("Purge")).toBeTruthy();
  });

  it("restores a deleted row via POST restore", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    mockApiFetch.mockResolvedValueOnce(sampleHardwareWithDeleted);
    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Show Deleted")!;
    await act(async () => { fireEvent.click(showDeletedBtn); });
    await waitFor(() => { expect(container.textContent).toContain("Old Part"); });
    mockApiFetch.mockResolvedValueOnce(undefined);
    mockApiFetch.mockResolvedValueOnce(sampleHardware);
    const restoreBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Restore")!;
    await act(async () => { fireEvent.click(restoreBtn); });
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/procurement/hardware/99/restore", expect.objectContaining({ method: "POST" }));
    });
  });

  it("shows error on restore failure", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    mockApiFetch.mockResolvedValueOnce(sampleHardwareWithDeleted);
    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Show Deleted")!;
    await act(async () => { fireEvent.click(showDeletedBtn); });
    await waitFor(() => { expect(container.textContent).toContain("Old Part"); });
    mockApiFetch.mockRejectedValueOnce(new Error("Restore failed"));
    const restoreBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Restore")!;
    await act(async () => { fireEvent.click(restoreBtn); });
    await waitFor(() => {
      expect(container.textContent).toContain("Restore failed");
    });
  });

  it("shows fallback 'Failed to restore' when non-Error is thrown", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    mockApiFetch.mockResolvedValueOnce(sampleHardwareWithDeleted);
    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Show Deleted")!;
    await act(async () => { fireEvent.click(showDeletedBtn); });
    await waitFor(() => { expect(container.textContent).toContain("Old Part"); });
    mockApiFetch.mockRejectedValueOnce("string error");
    const restoreBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Restore")!;
    await act(async () => { fireEvent.click(restoreBtn); });
    await waitFor(() => {
      expect(container.textContent).toContain("Failed to restore");
    });
  });

  it("shows purge confirmation and purges via DELETE permanent", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    mockApiFetch.mockResolvedValueOnce(sampleHardwareWithDeleted);
    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Show Deleted")!;
    await act(async () => { fireEvent.click(showDeletedBtn); });
    await waitFor(() => { expect(container.textContent).toContain("Old Part"); });
    const purgeBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Purge")!;
    await act(async () => { fireEvent.click(purgeBtn); });
    expect(container.textContent).toContain("Purge?");
    mockApiFetch.mockResolvedValueOnce(undefined);
    mockApiFetch.mockResolvedValueOnce(sampleHardware);
    const yesBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Yes")!;
    await act(async () => { fireEvent.click(yesBtn); });
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/procurement/hardware/99/permanent", expect.objectContaining({ method: "DELETE" }));
    });
  });

  it("cancels purge on No", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    mockApiFetch.mockResolvedValueOnce(sampleHardwareWithDeleted);
    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Show Deleted")!;
    await act(async () => { fireEvent.click(showDeletedBtn); });
    await waitFor(() => { expect(container.textContent).toContain("Old Part"); });
    const purgeBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Purge")!;
    await act(async () => { fireEvent.click(purgeBtn); });
    const noBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "No")!;
    await act(async () => { fireEvent.click(noBtn); });
    expect(container.textContent).not.toContain("Purge?");
  });

  it("shows error message on purge error (Error)", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    mockApiFetch.mockResolvedValueOnce(sampleHardwareWithDeleted);
    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Show Deleted")!;
    await act(async () => { fireEvent.click(showDeletedBtn); });
    await waitFor(() => { expect(container.textContent).toContain("Old Part"); });
    const purgeBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Purge")!;
    await act(async () => { fireEvent.click(purgeBtn); });
    mockApiFetch.mockRejectedValueOnce(new Error("Purge kaboom"));
    const yesBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Yes")!;
    await act(async () => { fireEvent.click(yesBtn); });
    await waitFor(() => {
      expect(container.textContent).toContain("Purge kaboom");
    });
  });

  it("shows fallback message on purge error (non-Error)", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    mockApiFetch.mockResolvedValueOnce(sampleHardwareWithDeleted);
    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Show Deleted")!;
    await act(async () => { fireEvent.click(showDeletedBtn); });
    await waitFor(() => { expect(container.textContent).toContain("Old Part"); });
    const purgeBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Purge")!;
    await act(async () => { fireEvent.click(purgeBtn); });
    mockApiFetch.mockRejectedValueOnce(999);
    const yesBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Yes")!;
    await act(async () => { fireEvent.click(yesBtn); });
    await waitFor(() => {
      expect(container.textContent).toContain("Failed to permanently delete");
    });
  });

  it("shows deleted count text", async () => {
    setupDefaultFetch();
    const { container } = render(<HardwarePage />);
    await waitFor(() => { expect(container.textContent).toContain("Hex Bolt"); });
    mockApiFetch.mockResolvedValueOnce(sampleHardwareWithDeleted);
    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Show Deleted")!;
    await act(async () => { fireEvent.click(showDeletedBtn); });
    await waitFor(() => {
      expect(container.textContent).toContain("(1 deleted)");
    });
  });
});
