import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor, fireEvent } from "@testing-library/react";

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
      <option value="">None</option>
      <option value="5">#5</option>
    </select>
  ),
}));

import PrintersPage from "./page";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mockApiFetch.mockImplementation((url: string) => {
    if (url === "/api/finance/journal") return Promise.resolve([]);
    return new Promise(() => {});
  });
});

const samplePrinters = [
  {
    printerId: 1,
    brand: "Bambu Lab",
    name: "A1 Mini",
    effective: "2025-03-15",
    baseCost: 299.0,
    taxes: 24.0,
    shipping: 0,
    cost: 323.0,
    hoursUsed: 500.2,
  },
  {
    printerId: 2,
    brand: "Bambu Lab",
    name: "P1S",
    effective: "2025-06-01",
    baseCost: 699.0,
    taxes: 56.0,
    shipping: 0,
    cost: 755.0,
    hoursUsed: 120.0,
    journalId: 3,
  },
  {
    printerId: 3,
    brand: "Creality",
    name: "Ender 3",
    effective: "2024-01-01",
    baseCost: 199.0,
    taxes: 16.0,
    shipping: 10.0,
    cost: 225.0,
    hoursUsed: 1000.0,
    deletedAt: "2025-01-15",
  },
];

function setupDefaultFetch(data = samplePrinters) {
  mockApiFetch.mockImplementation((url: string) => {
    if (url === "/api/finance/journal") return Promise.resolve([]);
    if (typeof url === "string" && url.startsWith("/api/procurement/printers")) return Promise.resolve(data);
    return Promise.resolve(data);
  });
}

describe("PrintersPage", () => {
  it("shows loading state initially", () => {
    const { container } = render(<PrintersPage />);
    expect(container.textContent).toContain("Loading...");
  });

  it("shows error state on fetch failure", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/api/finance/journal") return Promise.resolve([]);
      return Promise.reject(new Error("Server error"));
    });
    const { container } = render(<PrintersPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Server error");
    });
  });

  it("renders printer table with data", async () => {
    setupDefaultFetch();
    const { container } = render(<PrintersPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("A1 Mini");
    });
    expect(container.textContent).toContain("P1S");
    expect(container.textContent).toContain("Bambu Lab");
  });

  it("renders breadcrumb navigation", async () => {
    setupDefaultFetch();
    const { container } = render(<PrintersPage />);
    await waitFor(() => {
      expect(container.querySelector("a[href='/']")?.textContent).toBe("Home");
    });
    expect(container.querySelector("a[href='/procurement']")?.textContent).toBe("Procurement");
    expect(container.querySelector("nav span.text-foreground")?.textContent).toBe("Printers");
  });

  it("shows summary with count and total hours", async () => {
    setupDefaultFetch();
    const { container } = render(<PrintersPage />);
    await waitFor(() => {
      // 2 non-deleted printers
      expect(container.textContent).toContain("2 printers");
    });
    // 500.2 + 120.0 = 620.2 => "620" (toFixed(0))
    expect(container.textContent).toContain("620 total hours");
  });

  it("renders cost and hours columns with formatting", async () => {
    setupDefaultFetch();
    const { container } = render(<PrintersPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("500.2");
    });
    expect(container.textContent).toContain("120.0");
  });

  it("renders journal column with id or dash", async () => {
    setupDefaultFetch();
    const { container } = render(<PrintersPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("#3");
    });
    expect(container.textContent).toContain("\u2014");
  });

  it("excludes deleted items from summary count", async () => {
    setupDefaultFetch();
    const { container } = render(<PrintersPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("2 printers");
    });
    expect(container.textContent).toContain("620 total hours");
  });

  it("does not show summary when items are null (loading)", () => {
    const { container } = render(<PrintersPage />);
    expect(container.textContent).not.toContain("printers —");
  });

  it("renders the add form when Add Printer is clicked", async () => {
    setupDefaultFetch();
    const { container, getByText } = render(<PrintersPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("A1 Mini");
    });
    fireEvent.click(getByText("+ Add Printer"));
    expect(container.textContent).toContain("New Printer");
    expect(container.querySelector("input[placeholder='e.g. Bambu Lab']")).toBeTruthy();
    expect(container.querySelector("input[placeholder='e.g. A1 Lab']")).toBeTruthy();
    expect(container.querySelector("input[type='date']")).toBeTruthy();
    expect(container.querySelector("[data-testid='journal-select']")).toBeTruthy();
  });

  it("submits the add form with toPayload conversion", async () => {
    setupDefaultFetch();
    const { container, getByText } = render(<PrintersPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("A1 Mini");
    });
    fireEvent.click(getByText("+ Add Printer"));

    const brandInput = container.querySelector("input[placeholder='e.g. Bambu Lab']") as HTMLInputElement;
    const nameInput = container.querySelector("input[placeholder='e.g. A1 Lab']") as HTMLInputElement;
    fireEvent.change(brandInput, { target: { value: "Prusa" } });
    fireEvent.change(nameInput, { target: { value: "MK4" } });

    // Fill date
    const dateInput = container.querySelector("input[type='date']") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2025-09-01" } });

    const costInputs = container.querySelectorAll("input[placeholder='0.00']");
    fireEvent.change(costInputs[0]!, { target: { value: "799" } });
    fireEvent.change(costInputs[1]!, { target: { value: "64" } });
    fireEvent.change(costInputs[2]!, { target: { value: "0" } });
    fireEvent.change(costInputs[3]!, { target: { value: "863" } });

    // Fill hours
    const hoursInput = container.querySelector("input[placeholder='0']") as HTMLInputElement;
    fireEvent.change(hoursInput, { target: { value: "10" } });

    fireEvent.click(getByText("Save"));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/procurement/printers",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("renders the edit form with fromItem conversion (no journalId)", async () => {
    setupDefaultFetch();
    const { container, getAllByText } = render(<PrintersPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("A1 Mini");
    });
    const editButtons = getAllByText("Edit");
    fireEvent.click(editButtons[0]!);
    await waitFor(() => {
      const inputs = container.querySelectorAll("input");
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  it("renders the edit form with fromItem conversion (with journalId)", async () => {
    setupDefaultFetch();
    const { container, getAllByText } = render(<PrintersPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("P1S");
    });
    const editButtons = getAllByText("Edit");
    fireEvent.click(editButtons[1]!);
    await waitFor(() => {
      const inputs = container.querySelectorAll("input");
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  it("toPayload includes journalId when provided", async () => {
    setupDefaultFetch();
    const { container, getByText } = render(<PrintersPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("A1 Mini");
    });
    fireEvent.click(getByText("+ Add Printer"));

    const journalSelect = container.querySelector("[data-testid='journal-select']") as HTMLSelectElement;
    fireEvent.change(journalSelect, { target: { value: "5" } });

    const brandInput = container.querySelector("input[placeholder='e.g. Bambu Lab']") as HTMLInputElement;
    fireEvent.change(brandInput, { target: { value: "Test" } });

    fireEvent.click(getByText("Save"));
    await waitFor(() => {
      const call = mockApiFetch.mock.calls.find(
        (c: unknown[]) => c[1] && (c[1] as { method: string }).method === "POST",
      );
      expect(call).toBeTruthy();
      const body = JSON.parse((call![1] as { body: string }).body);
      expect(body.journalId).toBe(5);
    });
  });
});
