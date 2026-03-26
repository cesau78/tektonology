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

import PlatesPage from "./page";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mockApiFetch.mockImplementation((url: string) => {
    if (url === "/api/finance/journal") return Promise.resolve([]);
    return new Promise(() => {});
  });
});

const samplePlates = [
  {
    plateId: 1,
    brand: "Bambu",
    plate: "Textured PEI",
    effective: "2025-05-01",
    baseCost: 30.0,
    taxes: 2.4,
    shipping: 5.0,
    cost: 37.4,
    hoursUsed: 200.0,
  },
  {
    plateId: 2,
    brand: "Bambu",
    plate: "Cool Plate",
    effective: "2025-06-15",
    baseCost: 20.0,
    taxes: 1.6,
    shipping: 3.0,
    cost: 24.6,
    hoursUsed: 80.7,
    journalId: 12,
  },
  {
    plateId: 3,
    brand: "Bambu",
    plate: "Engineering Plate",
    effective: "2025-07-01",
    baseCost: 25.0,
    taxes: 2.0,
    shipping: 4.0,
    cost: 31.0,
    hoursUsed: 10.0,
    deletedAt: "2025-08-01",
  },
];

function setupDefaultFetch(data = samplePlates) {
  mockApiFetch.mockImplementation((url: string) => {
    if (url === "/api/finance/journal") return Promise.resolve([]);
    if (typeof url === "string" && url.startsWith("/api/procurement/plates")) return Promise.resolve(data);
    return Promise.resolve(data);
  });
}

describe("PlatesPage", () => {
  it("shows loading state initially", () => {
    const { container } = render(<PlatesPage />);
    expect(container.textContent).toContain("Loading...");
  });

  it("shows error state on fetch failure", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/api/finance/journal") return Promise.resolve([]);
      return Promise.reject(new Error("Server error"));
    });
    const { container } = render(<PlatesPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Server error");
    });
  });

  it("renders plate table with data", async () => {
    setupDefaultFetch();
    const { container } = render(<PlatesPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Textured PEI");
    });
    expect(container.textContent).toContain("Cool Plate");
    expect(container.textContent).toContain("Bambu");
  });

  it("renders breadcrumb navigation", async () => {
    setupDefaultFetch();
    const { container } = render(<PlatesPage />);
    await waitFor(() => {
      expect(container.querySelector("a[href='/']")?.textContent).toBe("Home");
    });
    expect(container.querySelector("a[href='/procurement']")?.textContent).toBe("Procurement");
    expect(container.querySelector("nav span.text-foreground")?.textContent).toBe("Plates");
  });

  it("shows summary with count and total hours", async () => {
    setupDefaultFetch();
    const { container } = render(<PlatesPage />);
    await waitFor(() => {
      // 2 non-deleted plates
      expect(container.textContent).toContain("2 plates");
    });
    // 200.0 + 80.7 = 280.7 => "281" (toFixed(0))
    expect(container.textContent).toContain("281 total hours");
  });

  it("renders cost and hours columns with formatting", async () => {
    setupDefaultFetch();
    const { container } = render(<PlatesPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("200.0");
    });
    expect(container.textContent).toContain("80.7");
  });

  it("renders journal column with id or dash", async () => {
    setupDefaultFetch();
    const { container } = render(<PlatesPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("#12");
    });
    expect(container.textContent).toContain("\u2014");
  });

  it("excludes deleted items from summary count", async () => {
    setupDefaultFetch();
    const { container } = render(<PlatesPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("2 plates");
    });
    expect(container.textContent).toContain("281 total hours");
  });

  it("does not show summary when items are null (loading)", () => {
    const { container } = render(<PlatesPage />);
    expect(container.textContent).not.toContain("plates —");
  });

  it("renders the add form when Add Plate is clicked", async () => {
    setupDefaultFetch();
    const { container, getByText } = render(<PlatesPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Textured PEI");
    });
    fireEvent.click(getByText("+ Add Plate"));
    expect(container.textContent).toContain("New Plate");
    expect(container.querySelector("input[placeholder='e.g. Bambu']")).toBeTruthy();
    expect(container.querySelector("input[placeholder='e.g. Textured PEI']")).toBeTruthy();
    expect(container.querySelector("input[type='date']")).toBeTruthy();
    expect(container.querySelector("[data-testid='journal-select']")).toBeTruthy();
  });

  it("submits the add form with toPayload conversion", async () => {
    setupDefaultFetch();
    const { container, getByText } = render(<PlatesPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Textured PEI");
    });
    fireEvent.click(getByText("+ Add Plate"));

    const brandInput = container.querySelector("input[placeholder='e.g. Bambu']") as HTMLInputElement;
    const plateInput = container.querySelector("input[placeholder='e.g. Textured PEI']") as HTMLInputElement;
    fireEvent.change(brandInput, { target: { value: "NewBrand" } });
    fireEvent.change(plateInput, { target: { value: "Smooth PEI" } });

    // Fill date
    const dateInput = container.querySelector("input[type='date']") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2025-09-01" } });

    const costInputs = container.querySelectorAll("input[placeholder='0.00']");
    fireEvent.change(costInputs[0]!, { target: { value: "10" } });
    fireEvent.change(costInputs[1]!, { target: { value: "1" } });
    fireEvent.change(costInputs[2]!, { target: { value: "2" } });
    fireEvent.change(costInputs[3]!, { target: { value: "13" } });

    // Fill hours
    const hoursInput = container.querySelector("input[placeholder='0']") as HTMLInputElement;
    fireEvent.change(hoursInput, { target: { value: "5.5" } });

    fireEvent.click(getByText("Save"));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/procurement/plates",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("renders the edit form with fromItem conversion (no journalId)", async () => {
    setupDefaultFetch();
    const { container, getAllByText } = render(<PlatesPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Textured PEI");
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
    const { container, getAllByText } = render(<PlatesPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Cool Plate");
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
    const { container, getByText } = render(<PlatesPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Textured PEI");
    });
    fireEvent.click(getByText("+ Add Plate"));

    const journalSelect = container.querySelector("[data-testid='journal-select']") as HTMLSelectElement;
    fireEvent.change(journalSelect, { target: { value: "5" } });

    const brandInput = container.querySelector("input[placeholder='e.g. Bambu']") as HTMLInputElement;
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

