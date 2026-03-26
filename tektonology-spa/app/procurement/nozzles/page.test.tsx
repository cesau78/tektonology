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

import NozzlesPage from "./page";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mockApiFetch.mockImplementation((url: string) => {
    if (url === "/api/finance/journal") return Promise.resolve([]);
    return new Promise(() => {});
  });
});

const sampleNozzles = [
  {
    nozzleId: 1,
    brand: "Bambu",
    nozzle: "0.4mm Stainless",
    effective: "2025-06-01",
    baseCost: 15.0,
    taxes: 1.2,
    shipping: 2.0,
    cost: 18.2,
    hoursUsed: 120.5,
  },
  {
    nozzleId: 2,
    brand: "E3D",
    nozzle: "0.6mm Hardened",
    effective: "2025-07-15",
    baseCost: 22.0,
    taxes: 1.8,
    shipping: 3.0,
    cost: 26.8,
    hoursUsed: 45.3,
    journalId: 7,
  },
  {
    nozzleId: 3,
    brand: "Bambu",
    nozzle: "0.2mm Stainless",
    effective: "2025-08-01",
    baseCost: 12.0,
    taxes: 0.99,
    shipping: 2.0,
    cost: 14.99,
    hoursUsed: 0,
    deletedAt: "2025-09-01",
  },
];

function setupDefaultFetch(data = sampleNozzles) {
  mockApiFetch.mockImplementation((url: string) => {
    if (url === "/api/finance/journal") return Promise.resolve([]);
    if (typeof url === "string" && url.startsWith("/api/procurement/nozzles")) return Promise.resolve(data);
    return Promise.resolve(data);
  });
}

describe("NozzlesPage", () => {
  it("shows loading state initially", () => {
    const { container } = render(<NozzlesPage />);
    expect(container.textContent).toContain("Loading...");
  });

  it("shows error state on fetch failure", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/api/finance/journal") return Promise.resolve([]);
      return Promise.reject(new Error("Server error"));
    });
    const { container } = render(<NozzlesPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Server error");
    });
  });

  it("renders nozzle table with data", async () => {
    setupDefaultFetch();
    const { container } = render(<NozzlesPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("0.4mm Stainless");
    });
    expect(container.textContent).toContain("0.6mm Hardened");
    expect(container.textContent).toContain("Bambu");
    expect(container.textContent).toContain("E3D");
  });

  it("renders breadcrumb navigation", async () => {
    setupDefaultFetch();
    const { container } = render(<NozzlesPage />);
    await waitFor(() => {
      expect(container.querySelector("a[href='/']")?.textContent).toBe("Home");
    });
    expect(container.querySelector("a[href='/procurement']")?.textContent).toBe("Procurement");
    expect(container.querySelector("nav span.text-foreground")?.textContent).toBe("Nozzles");
  });

  it("shows summary with count and total hours", async () => {
    setupDefaultFetch();
    const { container } = render(<NozzlesPage />);
    await waitFor(() => {
      // 2 non-deleted nozzles
      expect(container.textContent).toContain("2 nozzles");
    });
    // 120.5 + 45.3 = 165.8 => "166" (toFixed(0))
    expect(container.textContent).toContain("166 total hours");
  });

  it("renders cost and hours columns with formatting", async () => {
    setupDefaultFetch();
    const { container } = render(<NozzlesPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("120.5");
    });
    expect(container.textContent).toContain("45.3");
  });

  it("renders journal column with id or dash", async () => {
    setupDefaultFetch();
    const { container } = render(<NozzlesPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("#7");
    });
    // nozzleId=1 has no journalId => dash
    expect(container.textContent).toContain("\u2014");
  });

  it("excludes deleted items from summary count", async () => {
    setupDefaultFetch();
    const { container } = render(<NozzlesPage />);
    await waitFor(() => {
      // nozzleId=3 is deleted, so only 2 nozzles counted
      expect(container.textContent).toContain("2 nozzles");
    });
    // deleted nozzle hours (0) not in total: 120.5+45.3=165.8 => 166
    expect(container.textContent).toContain("166 total hours");
  });

  it("does not show summary when items are null (loading)", () => {
    const { container } = render(<NozzlesPage />);
    expect(container.textContent).not.toContain("nozzles —");
  });

  it("renders the add form when Add Nozzle is clicked", async () => {
    setupDefaultFetch();
    const { container, getByText } = render(<NozzlesPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("0.4mm Stainless");
    });
    fireEvent.click(getByText("+ Add Nozzle"));
    // Form fields should be visible
    expect(container.textContent).toContain("New Nozzle");
    expect(container.querySelector("input[placeholder='e.g. Bambu']")).toBeTruthy();
    expect(container.querySelector("input[placeholder='e.g. 0.4mm Stainless']")).toBeTruthy();
    expect(container.querySelector("input[type='date']")).toBeTruthy();
    expect(container.querySelector("[data-testid='journal-select']")).toBeTruthy();
  });

  it("submits the add form with toPayload conversion", async () => {
    setupDefaultFetch();
    const { container, getByText } = render(<NozzlesPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("0.4mm Stainless");
    });
    fireEvent.click(getByText("+ Add Nozzle"));

    // Fill brand and nozzle fields
    const brandInput = container.querySelector("input[placeholder='e.g. Bambu']") as HTMLInputElement;
    const nozzleInput = container.querySelector("input[placeholder='e.g. 0.4mm Stainless']") as HTMLInputElement;
    fireEvent.change(brandInput, { target: { value: "NewBrand" } });
    fireEvent.change(nozzleInput, { target: { value: "0.8mm" } });

    // Fill date
    const dateInput = container.querySelector("input[type='date']") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2025-09-01" } });

    // Fill cost fields
    const costInputs = container.querySelectorAll("input[placeholder='0.00']");
    fireEvent.change(costInputs[0]!, { target: { value: "10" } }); // baseCost
    fireEvent.change(costInputs[1]!, { target: { value: "1" } }); // taxes
    fireEvent.change(costInputs[2]!, { target: { value: "2" } }); // shipping
    fireEvent.change(costInputs[3]!, { target: { value: "13" } }); // cost

    // Fill hours
    const hoursInput = container.querySelector("input[placeholder='0']") as HTMLInputElement;
    fireEvent.change(hoursInput, { target: { value: "5.5" } });

    // Click Save
    fireEvent.click(getByText("Save"));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/procurement/nozzles",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("renders the edit form with fromItem conversion (no journalId)", async () => {
    setupDefaultFetch();
    const { container, getAllByText } = render(<NozzlesPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("0.4mm Stainless");
    });
    // Edit first item (nozzleId=1, no journalId) to cover fromItem journalId="" branch
    const editButtons = getAllByText("Edit");
    fireEvent.click(editButtons[0]!);
    await waitFor(() => {
      const inputs = container.querySelectorAll("input");
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  it("renders the edit form with fromItem conversion (with journalId)", async () => {
    setupDefaultFetch();
    const { container, getAllByText } = render(<NozzlesPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("0.6mm Hardened");
    });
    // Edit second item (nozzleId=2, journalId=7) to cover String(journalId) branch
    const editButtons = getAllByText("Edit");
    fireEvent.click(editButtons[1]!);
    await waitFor(() => {
      const inputs = container.querySelectorAll("input");
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  it("toPayload includes journalId when provided", async () => {
    setupDefaultFetch();
    const { container, getByText } = render(<NozzlesPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("0.4mm Stainless");
    });
    fireEvent.click(getByText("+ Add Nozzle"));

    // Fill journal select
    const journalSelect = container.querySelector("[data-testid='journal-select']") as HTMLSelectElement;
    fireEvent.change(journalSelect, { target: { value: "5" } });

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
