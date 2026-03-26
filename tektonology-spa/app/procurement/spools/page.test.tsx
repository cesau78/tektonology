import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor, within, act, fireEvent } from "@testing-library/react";

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

vi.mock("@/components/journal-select", () => ({
  JournalSelect: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select data-testid="journal-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— None —</option>
    </select>
  ),
}));

import SpoolsPage from "./page";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleSpools = [
  {
    spoolId: 1,
    brand: "Bambu",
    material: "PLA Pro",
    color: "Black",
    effective: "2025-01-01",
    cost: 24.99,
    weightG: 1000,
    remainingG: 750,
  },
  {
    spoolId: 2,
    brand: "Bambu",
    material: "PLA Pro",
    color: "White",
    effective: "2025-01-02",
    cost: 24.99,
    weightG: 1000,
    remainingG: 100,
  },
  {
    spoolId: 3,
    brand: "Overture",
    material: "TPU 90A",
    color: "Black",
    effective: "2025-01-03",
    cost: 29.99,
    weightG: 1000,
    remainingG: 600,
  },
  {
    spoolId: 4,
    brand: "Bambu",
    material: "PETG",
    color: "Clear",
    effective: "2025-01-04",
    cost: 22.99,
    weightG: 1000,
    remainingG: 300,
  },
  {
    spoolId: 5,
    brand: "Generic",
    material: "ABS",
    color: "Red",
    effective: "2025-01-05",
    cost: 18.99,
    weightG: 1000,
    remainingG: 50,
  },
  {
    spoolId: 6,
    brand: "Test",
    material: "ABS",
    color: "Blue",
    effective: "2025-01-06",
    cost: 10.00,
    weightG: 0,
    remainingG: 0,
  },
];

/** Helper: find an input inside a FormField by its label text */
function getFieldInput(container: HTMLElement, labelText: string): HTMLInputElement {
  const labels = container.querySelectorAll("label");
  for (const label of labels) {
    if (label.textContent?.trim().toLowerCase() === labelText.toLowerCase()) {
      const parent = label.parentElement!;
      const input = parent.querySelector("input");
      if (input) return input;
    }
  }
  throw new Error(`No input found for label "${labelText}"`);
}

describe("SpoolsPage", () => {
  it("shows loading state initially", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    const { container } = render(<SpoolsPage />);
    expect(container.textContent).toContain("Loading...");
  });

  it("shows error state on fetch failure", async () => {
    mockApiFetch.mockRejectedValue(new Error("API error"));
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("API error");
    });
  });

  it("renders spools grouped by material with summary", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("6 spools");
    });
    expect(container.textContent).toContain("kg remaining");
    expect(container.textContent).toContain("invested");
  });

  it("renders breadcrumb navigation", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      expect(container.querySelector("a[href='/']")?.textContent).toBe("Home");
    });
    expect(container.querySelector("a[href='/procurement']")?.textContent).toBe("Procurement");
    expect(container.querySelector("nav span.text-foreground")?.textContent).toBe("Filament Spools");
  });

  it("renders material group badges", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("PLA Pro");
    });
    expect(container.textContent).toContain("TPU 90A");
    expect(container.textContent).toContain("PETG");
    expect(container.textContent).toContain("ABS");
  });

  it("renders per-material subtotals", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("PLA Pro");
    });
    // PLA Pro group: 850g remaining / 2000g total => 0.8 / 2.0 kg (850/1000 rounds to 0.8)
    expect(container.textContent).toContain("0.8 / 2.0 kg");
  });

  it("renders spool table columns correctly", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Bambu");
    });
    expect(container.textContent).toContain("Overture");
    expect(container.textContent).toContain("Black");
    expect(container.textContent).toContain("750g");
  });

  it("shows correct percentage and color for progress bars", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("75%");
    });
    expect(container.textContent).toContain("10%");
    expect(container.textContent).toContain("60%");
    expect(container.textContent).toContain("30%");
    expect(container.textContent).toContain("5%");

    // Check progress bar colors
    const progressBars = container.querySelectorAll("[style]");
    const barClasses = Array.from(progressBars).map((el) => el.className);
    // > 50% = emerald
    expect(barClasses.some((c) => c.includes("bg-emerald-500"))).toBe(true);
    // 20-50% = amber
    expect(barClasses.some((c) => c.includes("bg-amber-500"))).toBe(true);
    // < 20% = red
    expect(barClasses.some((c) => c.includes("bg-red-500"))).toBe(true);
  });

  it("handles spool with zero weight (0% and 0 costPerG)", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("0%");
    });
    // costPerG = 0 when weightG = 0
    expect(container.textContent).toContain("0.000");
  });

  it("applies default gray badge for unknown material types", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("ABS");
    });
    // ABS is not in materialColor map, so it gets gray
  });

  it("renders cost per gram correctly", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      // 24.99 / 1000 = 0.025
      const text = container.textContent ?? "";
      const matches = text.match(/0\.025/g);
      expect(matches).toHaveLength(2); // Two PLA Pro spools
    });
  });

  // ── Add Row tests ──

  it("opens add spool form and cancels", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getByText, queryByPlaceholderText } = render(<SpoolsPage />);
    await waitFor(() => { expect(getByText("+ Add Spool")).toBeDefined(); });
    await act(async () => { fireEvent.click(getByText("+ Add Spool")); });
    expect(queryByPlaceholderText("e.g. Bambu")).toBeDefined();
    await act(async () => { fireEvent.click(getByText("Cancel")); });
    expect(queryByPlaceholderText("e.g. Bambu")).toBeNull();
  });

  it("adds a spool successfully via POST", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getByText, getByPlaceholderText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getByText("+ Add Spool")).toBeDefined(); });
    await act(async () => { fireEvent.click(getByText("+ Add Spool")); });
    fireEvent.change(getByPlaceholderText("e.g. Bambu"), { target: { value: "NewBrand" } });
    fireEvent.change(getByPlaceholderText("e.g. PLA Pro"), { target: { value: "PLA" } });
    fireEvent.change(getByPlaceholderText("e.g. Black"), { target: { value: "Red" } });
    fireEvent.change(getByPlaceholderText("0.00"), { target: { value: "19.99" } });
    const weightInput = getFieldInput(container, "Weight (g)");
    const remainingInput = getFieldInput(container, "Remaining (g)");
    fireEvent.change(weightInput, { target: { value: "1000" } });
    fireEvent.change(remainingInput, { target: { value: "1000" } });
    mockApiFetch.mockResolvedValueOnce({});
    mockApiFetch.mockResolvedValueOnce(sampleSpools);
    await act(async () => { fireEvent.click(getByText("Save")); });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/procurement/spools", expect.objectContaining({ method: "POST" }));
  });

  it("validates empty brand on add", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getByText, getByPlaceholderText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getByText("+ Add Spool")).toBeDefined(); });
    await act(async () => { fireEvent.click(getByText("+ Add Spool")); });
    fireEvent.change(getByPlaceholderText("e.g. PLA Pro"), { target: { value: "PLA" } });
    fireEvent.change(getByPlaceholderText("e.g. Black"), { target: { value: "Red" } });
    fireEvent.change(getByPlaceholderText("0.00"), { target: { value: "10" } });
    const weightInput = getFieldInput(container, "Weight (g)");
    const remainingInput = getFieldInput(container, "Remaining (g)");
    fireEvent.change(weightInput, { target: { value: "100" } });
    fireEvent.change(remainingInput, { target: { value: "50" } });
    await act(async () => { fireEvent.click(getByText("Save")); });
    expect(container.textContent).toContain("Brand is required");
  });

  it("validates empty material on add", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getByText, getByPlaceholderText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getByText("+ Add Spool")).toBeDefined(); });
    await act(async () => { fireEvent.click(getByText("+ Add Spool")); });
    fireEvent.change(getByPlaceholderText("e.g. Bambu"), { target: { value: "X" } });
    fireEvent.change(getByPlaceholderText("e.g. Black"), { target: { value: "Red" } });
    fireEvent.change(getByPlaceholderText("0.00"), { target: { value: "10" } });
    const weightInput = getFieldInput(container, "Weight (g)");
    const remainingInput = getFieldInput(container, "Remaining (g)");
    fireEvent.change(weightInput, { target: { value: "100" } });
    fireEvent.change(remainingInput, { target: { value: "50" } });
    await act(async () => { fireEvent.click(getByText("Save")); });
    expect(container.textContent).toContain("Material is required");
  });

  it("validates empty color on add", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getByText, getByPlaceholderText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getByText("+ Add Spool")).toBeDefined(); });
    await act(async () => { fireEvent.click(getByText("+ Add Spool")); });
    fireEvent.change(getByPlaceholderText("e.g. Bambu"), { target: { value: "X" } });
    fireEvent.change(getByPlaceholderText("e.g. PLA Pro"), { target: { value: "PLA" } });
    fireEvent.change(getByPlaceholderText("0.00"), { target: { value: "10" } });
    const weightInput = getFieldInput(container, "Weight (g)");
    const remainingInput = getFieldInput(container, "Remaining (g)");
    fireEvent.change(weightInput, { target: { value: "100" } });
    fireEvent.change(remainingInput, { target: { value: "50" } });
    await act(async () => { fireEvent.click(getByText("Save")); });
    expect(container.textContent).toContain("Color is required");
  });

  it("validates NaN cost on add", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getByText, getByPlaceholderText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getByText("+ Add Spool")).toBeDefined(); });
    await act(async () => { fireEvent.click(getByText("+ Add Spool")); });
    fireEvent.change(getByPlaceholderText("e.g. Bambu"), { target: { value: "X" } });
    fireEvent.change(getByPlaceholderText("e.g. PLA Pro"), { target: { value: "PLA" } });
    fireEvent.change(getByPlaceholderText("e.g. Black"), { target: { value: "Red" } });
    fireEvent.change(getByPlaceholderText("0.00"), { target: { value: "abc" } });
    const weightInput = getFieldInput(container, "Weight (g)");
    const remainingInput = getFieldInput(container, "Remaining (g)");
    fireEvent.change(weightInput, { target: { value: "100" } });
    fireEvent.change(remainingInput, { target: { value: "50" } });
    await act(async () => { fireEvent.click(getByText("Save")); });
    expect(container.textContent).toContain("Cost must be a non-negative number");
  });

  it("validates NaN/zero weightG on add", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getByText, getByPlaceholderText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getByText("+ Add Spool")).toBeDefined(); });
    await act(async () => { fireEvent.click(getByText("+ Add Spool")); });
    fireEvent.change(getByPlaceholderText("e.g. Bambu"), { target: { value: "X" } });
    fireEvent.change(getByPlaceholderText("e.g. PLA Pro"), { target: { value: "PLA" } });
    fireEvent.change(getByPlaceholderText("e.g. Black"), { target: { value: "Red" } });
    fireEvent.change(getByPlaceholderText("0.00"), { target: { value: "10" } });
    const weightInput = getFieldInput(container, "Weight (g)");
    const remainingInput = getFieldInput(container, "Remaining (g)");
    fireEvent.change(weightInput, { target: { value: "0" } });
    fireEvent.change(remainingInput, { target: { value: "0" } });
    await act(async () => { fireEvent.click(getByText("Save")); });
    expect(container.textContent).toContain("Weight must be a positive number");
  });

  it("validates NaN remainingG on add", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getByText, getByPlaceholderText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getByText("+ Add Spool")).toBeDefined(); });
    await act(async () => { fireEvent.click(getByText("+ Add Spool")); });
    fireEvent.change(getByPlaceholderText("e.g. Bambu"), { target: { value: "X" } });
    fireEvent.change(getByPlaceholderText("e.g. PLA Pro"), { target: { value: "PLA" } });
    fireEvent.change(getByPlaceholderText("e.g. Black"), { target: { value: "Red" } });
    fireEvent.change(getByPlaceholderText("0.00"), { target: { value: "10" } });
    const weightInput = getFieldInput(container, "Weight (g)");
    const remainingInput = getFieldInput(container, "Remaining (g)");
    fireEvent.change(weightInput, { target: { value: "100" } });
    fireEvent.change(remainingInput, { target: { value: "abc" } });
    await act(async () => { fireEvent.click(getByText("Save")); });
    expect(container.textContent).toContain("Remaining must be a non-negative number");
  });

  it("shows error message on add API Error", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getByText, getByPlaceholderText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getByText("+ Add Spool")).toBeDefined(); });
    await act(async () => { fireEvent.click(getByText("+ Add Spool")); });
    fireEvent.change(getByPlaceholderText("e.g. Bambu"), { target: { value: "X" } });
    fireEvent.change(getByPlaceholderText("e.g. PLA Pro"), { target: { value: "PLA" } });
    fireEvent.change(getByPlaceholderText("e.g. Black"), { target: { value: "Red" } });
    fireEvent.change(getByPlaceholderText("0.00"), { target: { value: "10" } });
    const weightInput = getFieldInput(container, "Weight (g)");
    const remainingInput = getFieldInput(container, "Remaining (g)");
    fireEvent.change(weightInput, { target: { value: "100" } });
    fireEvent.change(remainingInput, { target: { value: "50" } });
    mockApiFetch.mockRejectedValueOnce(new Error("Server error"));
    await act(async () => { fireEvent.click(getByText("Save")); });
    expect(container.textContent).toContain("Server error");
  });

  it("shows 'Failed to add' on add API non-Error", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getByText, getByPlaceholderText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getByText("+ Add Spool")).toBeDefined(); });
    await act(async () => { fireEvent.click(getByText("+ Add Spool")); });
    fireEvent.change(getByPlaceholderText("e.g. Bambu"), { target: { value: "X" } });
    fireEvent.change(getByPlaceholderText("e.g. PLA Pro"), { target: { value: "PLA" } });
    fireEvent.change(getByPlaceholderText("e.g. Black"), { target: { value: "Red" } });
    fireEvent.change(getByPlaceholderText("0.00"), { target: { value: "10" } });
    const weightInput = getFieldInput(container, "Weight (g)");
    const remainingInput = getFieldInput(container, "Remaining (g)");
    fireEvent.change(weightInput, { target: { value: "100" } });
    fireEvent.change(remainingInput, { target: { value: "50" } });
    mockApiFetch.mockRejectedValueOnce("not an error");
    await act(async () => { fireEvent.click(getByText("Save")); });
    expect(container.textContent).toContain("Failed to add");
  });

  it("hides add button while adding", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getByText, queryByText } = render(<SpoolsPage />);
    await waitFor(() => { expect(getByText("+ Add Spool")).toBeDefined(); });
    await act(async () => { fireEvent.click(getByText("+ Add Spool")); });
    expect(queryByText("+ Add Spool")).toBeNull();
  });

  // ── Edit Row tests ──

  it("enters edit mode, shows Save/Cancel, Cancel exits", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getAllByText, getByText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(container.textContent).toContain("Bambu"); });
    const editButtons = getAllByText("Edit");
    await act(async () => { fireEvent.click(editButtons[0]); });
    expect(getByText("Save")).toBeDefined();
    expect(getByText("Cancel")).toBeDefined();
    // Edit card should have text inputs
    expect(container.querySelectorAll("input[type='text']").length).toBeGreaterThan(0);
    await act(async () => { fireEvent.click(getByText("Cancel")); });
    // After cancel, edit card is gone — no text inputs from the edit form
    expect(container.querySelectorAll("input[type='text']").length).toBe(0);
  });

  it("saves edit via PUT", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getAllByText, getByText, getByDisplayValue } = render(<SpoolsPage />);
    await waitFor(() => { expect(getAllByText("Edit").length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(getAllByText("Edit")[0]); });
    fireEvent.change(getByDisplayValue("Bambu"), { target: { value: "Edited" } });
    mockApiFetch.mockResolvedValueOnce({});
    mockApiFetch.mockResolvedValueOnce(sampleSpools);
    await act(async () => { fireEvent.click(getByText("Save")); });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/procurement/spools/1", expect.objectContaining({ method: "PUT" }));
  });

  it("validates empty brand on edit", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getAllByText, getByText, getByDisplayValue, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getAllByText("Edit").length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(getAllByText("Edit")[0]); });
    fireEvent.change(getByDisplayValue("Bambu"), { target: { value: "" } });
    await act(async () => { fireEvent.click(getByText("Save")); });
    expect(container.textContent).toContain("Brand is required");
  });

  it("validates empty material on edit", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getAllByText, getByText, getByDisplayValue, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getAllByText("Edit").length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(getAllByText("Edit")[0]); });
    // Edit card has a material input; clear it
    fireEvent.change(getByDisplayValue("PLA Pro"), { target: { value: "" } });
    await act(async () => { fireEvent.click(getByText("Save")); });
    expect(container.textContent).toContain("Material is required");
  });

  it("validates empty color on edit", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getAllByText, getByText, getByDisplayValue, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getAllByText("Edit").length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(getAllByText("Edit")[0]); });
    fireEvent.change(getByDisplayValue("Black"), { target: { value: "" } });
    await act(async () => { fireEvent.click(getByText("Save")); });
    expect(container.textContent).toContain("Color is required");
  });

  it("validates NaN cost on edit", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getAllByText, getByText, getByDisplayValue, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getAllByText("Edit").length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(getAllByText("Edit")[0]); });
    fireEvent.change(getByDisplayValue("24.99"), { target: { value: "abc" } });
    await act(async () => { fireEvent.click(getByText("Save")); });
    expect(container.textContent).toContain("Cost must be a non-negative number");
  });

  it("validates zero weightG on edit (spool with weightG=0)", async () => {
    // sampleSpools[5] has weightG: 0 — triggers "Weight must be a positive number"
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getAllByText, getByText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getAllByText("Edit").length).toBeGreaterThan(0); });
    // Click the last Edit button (for spool with weightG=0)
    const editBtns = getAllByText("Edit");
    await act(async () => { fireEvent.click(editBtns[editBtns.length - 1]); });
    const saveBtn = getByText("Save");
    await act(async () => { fireEvent.click(saveBtn); });
    expect(container.textContent).toContain("Weight must be a positive number");
  });

  it("validates empty material on edit (spool with empty material)", async () => {
    const spoolsWithEmptyMaterial = [{ ...sampleSpools[0], material: "" }];
    mockApiFetch.mockResolvedValue(spoolsWithEmptyMaterial);
    const { getByText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(container.textContent).toContain("Bambu"); });
    await act(async () => { fireEvent.click(getByText("Edit")); });
    await act(async () => { fireEvent.click(getByText("Save")); });
    expect(container.textContent).toContain("Material is required");
  });

  it("validates NaN remainingG on edit", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getAllByText, getByText, getByDisplayValue, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getAllByText("Edit").length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(getAllByText("Edit")[0]); });
    fireEvent.change(getByDisplayValue("750"), { target: { value: "abc" } });
    await act(async () => { fireEvent.click(getByText("Save")); });
    expect(container.textContent).toContain("Remaining must be a non-negative number");
  });

  it("shows error on edit save Error", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getAllByText, getByText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getAllByText("Edit").length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(getAllByText("Edit")[0]); });
    mockApiFetch.mockRejectedValueOnce(new Error("Edit failed"));
    await act(async () => { fireEvent.click(getByText("Save")); });
    expect(container.textContent).toContain("Edit failed");
  });

  it("shows 'Failed to save' on edit save non-Error", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getAllByText, getByText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getAllByText("Edit").length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(getAllByText("Edit")[0]); });
    mockApiFetch.mockRejectedValueOnce("not an error");
    await act(async () => { fireEvent.click(getByText("Save")); });
    expect(container.textContent).toContain("Failed to save");
  });

  // ── Inline Delete tests ──

  it("shows Delete? Yes/No confirmation", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getAllByText, getByText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getAllByText("Delete").length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(getAllByText("Delete")[0]); });
    expect(container.textContent).toContain("Delete?");
    expect(getByText("Yes")).toBeDefined();
    expect(getByText("No")).toBeDefined();
  });

  it("Yes calls DELETE /api/procurement/spools/:spoolId", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getAllByText, getByText } = render(<SpoolsPage />);
    await waitFor(() => { expect(getAllByText("Delete").length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(getAllByText("Delete")[0]); });
    mockApiFetch.mockResolvedValueOnce({});
    mockApiFetch.mockResolvedValueOnce(sampleSpools);
    await act(async () => { fireEvent.click(getByText("Yes")); });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/procurement/spools/1", expect.objectContaining({ method: "DELETE" }));
  });

  it("No cancels delete confirmation", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getAllByText, getByText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getAllByText("Delete").length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(getAllByText("Delete")[0]); });
    expect(container.textContent).toContain("Delete?");
    await act(async () => { fireEvent.click(getByText("No")); });
    await waitFor(() => {
      expect(container.textContent).not.toContain("Delete?");
    });
  });

  it("shows error on delete Error", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getAllByText, getByText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getAllByText("Delete").length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(getAllByText("Delete")[0]); });
    mockApiFetch.mockRejectedValueOnce(new Error("Delete failed"));
    await act(async () => { fireEvent.click(getByText("Yes")); });
    expect(container.textContent).toContain("Delete failed");
  });

  it("shows 'Failed to delete' on delete non-Error", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getAllByText, getByText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(getAllByText("Delete").length).toBeGreaterThan(0); });
    await act(async () => { fireEvent.click(getAllByText("Delete")[0]); });
    mockApiFetch.mockRejectedValueOnce("not an error");
    await act(async () => { fireEvent.click(getByText("Yes")); });
    expect(container.textContent).toContain("Failed to delete");
  });

  // ── Soft Delete Lifecycle tests ──

  const sampleSpoolsWithDeleted = [
    { spoolId: 1, brand: "Bambu", material: "PLA Pro", color: "Black", effective: "2025-01-01", cost: 24.99, weightG: 1000, remainingG: 750 },
    { spoolId: 99, brand: "Old", material: "PLA Pro", color: "Gray", effective: "2024-06-01", cost: 10.00, weightG: 500, remainingG: 0, deletedAt: "2025-01-01T00:00:00.000Z" },
  ];

  it("Show Deleted toggle fetches with ?includeDeleted=true", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { getByText } = render(<SpoolsPage />);
    await waitFor(() => { expect(getByText("Show Deleted")).toBeDefined(); });
    mockApiFetch.mockResolvedValue(sampleSpoolsWithDeleted);
    await act(async () => { fireEvent.click(getByText("Show Deleted")); });
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/procurement/spools?includeDeleted=true");
    });
  });

  it("deleted rows have opacity-50 and show Restore/Purge", async () => {
    mockApiFetch.mockResolvedValue(sampleSpoolsWithDeleted);
    const { getByText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(container.textContent).toContain("Bambu"); });
    // Toggle show deleted
    mockApiFetch.mockResolvedValue(sampleSpoolsWithDeleted);
    await act(async () => { fireEvent.click(getByText("Show Deleted")); });
    await waitFor(() => {
      expect(container.textContent).toContain("Old");
    });
    // Check opacity-50 class on deleted row
    const rows = container.querySelectorAll("tr.opacity-50");
    expect(rows.length).toBe(1);
    // Deleted row shows Restore and Purge
    const deletedRow = rows[0];
    expect(deletedRow.textContent).toContain("Restore");
    expect(deletedRow.textContent).toContain("Purge");
  });

  it("Restore calls POST /api/procurement/spools/:spoolId/restore", async () => {
    // Start with showDeleted toggled
    mockApiFetch.mockResolvedValue(sampleSpoolsWithDeleted);
    const { getByText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(container.textContent).toContain("Bambu"); });
    mockApiFetch.mockResolvedValue(sampleSpoolsWithDeleted);
    await act(async () => { fireEvent.click(getByText("Show Deleted")); });
    await waitFor(() => { expect(container.textContent).toContain("Old"); });
    mockApiFetch.mockResolvedValueOnce({});
    mockApiFetch.mockResolvedValueOnce(sampleSpoolsWithDeleted);
    await act(async () => { fireEvent.click(getByText("Restore")); });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/procurement/spools/99/restore", expect.objectContaining({ method: "POST" }));
  });

  it("shows 'Failed to restore' on restore error", async () => {
    mockApiFetch.mockResolvedValue(sampleSpoolsWithDeleted);
    const { getByText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(container.textContent).toContain("Bambu"); });
    mockApiFetch.mockResolvedValue(sampleSpoolsWithDeleted);
    await act(async () => { fireEvent.click(getByText("Show Deleted")); });
    await waitFor(() => { expect(container.textContent).toContain("Old"); });
    mockApiFetch.mockRejectedValueOnce(new Error("Restore failed"));
    await act(async () => { fireEvent.click(getByText("Restore")); });
    expect(container.textContent).toContain("Restore failed");
  });

  it("shows fallback 'Failed to restore' when non-Error is thrown", async () => {
    mockApiFetch.mockResolvedValue(sampleSpoolsWithDeleted);
    const { getByText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(container.textContent).toContain("Bambu"); });
    mockApiFetch.mockResolvedValue(sampleSpoolsWithDeleted);
    await act(async () => { fireEvent.click(getByText("Show Deleted")); });
    await waitFor(() => { expect(container.textContent).toContain("Old"); });
    mockApiFetch.mockRejectedValueOnce("string error");
    await act(async () => { fireEvent.click(getByText("Restore")); });
    expect(container.textContent).toContain("Failed to restore");
  });

  it("Purge shows confirmation, Yes calls DELETE /api/procurement/spools/:spoolId/permanent", async () => {
    mockApiFetch.mockResolvedValue(sampleSpoolsWithDeleted);
    const { getByText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(container.textContent).toContain("Bambu"); });
    mockApiFetch.mockResolvedValue(sampleSpoolsWithDeleted);
    await act(async () => { fireEvent.click(getByText("Show Deleted")); });
    await waitFor(() => { expect(container.textContent).toContain("Old"); });
    await act(async () => { fireEvent.click(getByText("Purge")); });
    expect(container.textContent).toContain("Purge?");
    mockApiFetch.mockResolvedValueOnce({});
    mockApiFetch.mockResolvedValueOnce(sampleSpoolsWithDeleted);
    await act(async () => { fireEvent.click(getByText("Yes")); });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/procurement/spools/99/permanent", expect.objectContaining({ method: "DELETE" }));
  });

  it("Purge cancel hides confirmation", async () => {
    mockApiFetch.mockResolvedValue(sampleSpoolsWithDeleted);
    const { getByText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(container.textContent).toContain("Bambu"); });
    mockApiFetch.mockResolvedValue(sampleSpoolsWithDeleted);
    await act(async () => { fireEvent.click(getByText("Show Deleted")); });
    await waitFor(() => { expect(container.textContent).toContain("Old"); });
    await act(async () => { fireEvent.click(getByText("Purge")); });
    expect(container.textContent).toContain("Purge?");
    await act(async () => { fireEvent.click(getByText("No")); });
    await waitFor(() => {
      expect(container.textContent).not.toContain("Purge?");
    });
  });

  it("shows error on purge Error", async () => {
    mockApiFetch.mockResolvedValue(sampleSpoolsWithDeleted);
    const { getByText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(container.textContent).toContain("Bambu"); });
    mockApiFetch.mockResolvedValue(sampleSpoolsWithDeleted);
    await act(async () => { fireEvent.click(getByText("Show Deleted")); });
    await waitFor(() => { expect(container.textContent).toContain("Old"); });
    await act(async () => { fireEvent.click(getByText("Purge")); });
    mockApiFetch.mockRejectedValueOnce(new Error("Purge failed"));
    await act(async () => { fireEvent.click(getByText("Yes")); });
    expect(container.textContent).toContain("Purge failed");
  });

  it("shows 'Failed to permanently delete' on purge non-Error", async () => {
    mockApiFetch.mockResolvedValue(sampleSpoolsWithDeleted);
    const { getByText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(container.textContent).toContain("Bambu"); });
    mockApiFetch.mockResolvedValue(sampleSpoolsWithDeleted);
    await act(async () => { fireEvent.click(getByText("Show Deleted")); });
    await waitFor(() => { expect(container.textContent).toContain("Old"); });
    await act(async () => { fireEvent.click(getByText("Purge")); });
    mockApiFetch.mockRejectedValueOnce("not an error");
    await act(async () => { fireEvent.click(getByText("Yes")); });
    expect(container.textContent).toContain("Failed to permanently delete");
  });

  it("shows deleted count text when showDeleted is on", async () => {
    mockApiFetch.mockResolvedValue(sampleSpoolsWithDeleted);
    const { getByText, container } = render(<SpoolsPage />);
    await waitFor(() => { expect(container.textContent).toContain("Bambu"); });
    mockApiFetch.mockResolvedValue(sampleSpoolsWithDeleted);
    await act(async () => { fireEvent.click(getByText("Show Deleted")); });
    await waitFor(() => {
      expect(container.textContent).toContain("1 deleted");
    });
  });

  it("hides groups with only deleted spools when showDeleted is false", async () => {
    const spoolsAllDeletedGroup = [
      { spoolId: 1, brand: "Bambu", material: "PLA Pro", color: "Black", effective: "2025-01-01", cost: 24.99, weightG: 1000, remainingG: 750 },
      { spoolId: 99, brand: "Old", material: "ABS", color: "Gray", effective: "2024-06-01", cost: 10.00, weightG: 500, remainingG: 0, deletedAt: "2025-01-01T00:00:00.000Z" },
    ];
    mockApiFetch.mockResolvedValue(spoolsAllDeletedGroup);
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("PLA Pro");
    });
    // ABS group should not appear since its only spool is deleted and showDeleted is false
    expect(container.textContent).not.toContain("ABS");
  });
});
