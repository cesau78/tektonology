import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import React from "react";

const mockApiFetch = vi.fn();
const mockUseRole = vi.fn();

vi.mock("@auth0/auth0-react", () => ({
  useAuth0: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { email_verified: true },
    getAccessTokenSilently: vi.fn(),
    loginWithRedirect: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  useApiFetch: () => mockApiFetch,
}));

vi.mock("@/lib/auth", () => ({
  useRole: () => mockUseRole(),
  canWrite: (role: string) => role === "owner",
  canAccessFinance: () => true,
  isAuthenticated: () => true,
}));

vi.mock("@/components/auth-guard", () => ({
  RequireRole: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import SalesPage from "./page";

const sampleSales = [
  {
    saleId: 1,
    effective: "2025-06-01",
    customer: "St. Mary's Parish",
    items: [
      { inventoryId: 10, product: "Upper Boot", quantity: 4, unitPrice: 5.0, amount: 20.0 },
    ],
    revenue: 20.0,
  },
  {
    saleId: 2,
    effective: "2025-06-15",
    customer: "Holy Cross",
    items: [],
    revenue: 50.0,
  },
  {
    saleId: 3,
    effective: "2025-01-01",
    customer: "Deleted Sale",
    items: [],
    revenue: 10.0,
    deletedAt: "2025-05-01",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRole.mockReturnValue({ role: "owner", isLoaded: true });
});

afterEach(() => {
  cleanup();
});

describe("SalesPage", () => {
  it("shows loading state while fetching", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    render(<SalesPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    mockApiFetch.mockRejectedValue(new Error("Server error"));
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("renders sales data after loading", async () => {
    mockApiFetch.mockResolvedValue(sampleSales);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("St. Mary's Parish")).toBeInTheDocument();
    });
    expect(screen.getByText("Holy Cross")).toBeInTheDocument();
  });

  it("renders breadcrumb navigation", async () => {
    mockApiFetch.mockResolvedValue(sampleSales);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("Home")).toBeInTheDocument();
    });
    const breadcrumbSales = screen.getAllByText("Sales");
    expect(breadcrumbSales.length).toBeGreaterThanOrEqual(2); // breadcrumb + heading
  });

  it("shows total revenue summary", async () => {
    mockApiFetch.mockResolvedValue(sampleSales);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText(/2 sales/)).toBeInTheDocument();
    });
    expect(screen.getByText(/\$70\.00 total revenue/)).toBeInTheDocument();
  });

  it("hides deleted sales by default", async () => {
    mockApiFetch.mockResolvedValue(sampleSales);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("St. Mary's Parish")).toBeInTheDocument();
    });
    expect(screen.queryByText("Deleted Sale")).not.toBeInTheDocument();
  });

  it("shows deleted sales when Show Deleted is clicked", async () => {
    mockApiFetch.mockResolvedValue(sampleSales);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("St. Mary's Parish")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Show Deleted"));
    });
    await waitFor(() => {
      expect(screen.getByText("Deleted Sale")).toBeInTheDocument();
    });
    expect(screen.getByText("Hide Deleted")).toBeInTheDocument();
  });

  it("shows Add Sale button for writable role", async () => {
    mockApiFetch.mockResolvedValue(sampleSales);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Sale")).toBeInTheDocument();
    });
  });

  it("hides Add Sale button for non-writable role", async () => {
    mockUseRole.mockReturnValue({ role: "member", isLoaded: true });
    mockApiFetch.mockResolvedValue(sampleSales);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("St. Mary's Parish")).toBeInTheDocument();
    });
    expect(screen.queryByText("+ Add Sale")).not.toBeInTheDocument();
  });

  it("opens add form and validates required fields", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Sale")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("+ Add Sale"));
    });
    expect(screen.getByPlaceholderText("Customer")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    expect(screen.getByText("Customer and date required")).toBeInTheDocument();
  });

  it("successfully adds a sale", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Sale")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("+ Add Sale"));
    });
    const customerInput = screen.getByPlaceholderText("Customer");
    const revenueInput = screen.getByPlaceholderText("Revenue");
    const dateInputEl = customerInput.closest(".grid")!.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInputEl, { target: { value: "2025-07-01" } });
    fireEvent.change(customerInput, { target: { value: "New Customer" } });
    fireEvent.change(revenueInput, { target: { value: "100" } });
    mockApiFetch.mockResolvedValueOnce({}).mockResolvedValueOnce([]);
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    expect(screen.queryByPlaceholderText("Customer")).not.toBeInTheDocument();
  });

  it("cancels add form and clears action error", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Sale")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("+ Add Sale"));
    });
    // Trigger validation error
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    expect(screen.getByText("Customer and date required")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByText("Cancel"));
    });
    expect(screen.queryByPlaceholderText("Customer")).not.toBeInTheDocument();
  });

  it("enters edit mode and saves changes", async () => {
    mockApiFetch.mockResolvedValue(sampleSales);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("St. Mary's Parish")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByText("Edit");
    await act(async () => {
      fireEvent.click(editButtons[0]);
    });
    // Should show edit fields
    const customerInput = screen.getByDisplayValue("St. Mary's Parish");
    expect(customerInput).toBeInTheDocument();
    fireEvent.change(customerInput, { target: { value: "Updated Customer" } });
    mockApiFetch.mockResolvedValueOnce({}).mockResolvedValueOnce(sampleSales);
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/sales/1", expect.objectContaining({ method: "PUT" }));
  });

  it("cancels edit mode", async () => {
    mockApiFetch.mockResolvedValue(sampleSales);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("St. Mary's Parish")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByText("Edit");
    await act(async () => {
      fireEvent.click(editButtons[0]);
    });
    expect(screen.getByDisplayValue("St. Mary's Parish")).toBeInTheDocument();
    const cancelButtons = screen.getAllByText("Cancel");
    await act(async () => {
      fireEvent.click(cancelButtons[cancelButtons.length - 1]);
    });
    expect(screen.queryByDisplayValue("St. Mary's Parish")).not.toBeInTheDocument();
    expect(screen.getByText("St. Mary's Parish")).toBeInTheDocument();
  });

  it("changes edit fields (date, revenue)", async () => {
    mockApiFetch.mockResolvedValue(sampleSales);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("St. Mary's Parish")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByText("Edit");
    await act(async () => {
      fireEvent.click(editButtons[0]);
    });
    const dateInput = screen.getByDisplayValue("2025-06-01");
    fireEvent.change(dateInput, { target: { value: "2025-07-01" } });
    expect(dateInput).toHaveValue("2025-07-01");
    const revenueInput = screen.getByDisplayValue("20");
    fireEvent.change(revenueInput, { target: { value: "100" } });
    expect(revenueInput).toHaveValue(100);
  });

  it("deletes a sale with confirmation", async () => {
    mockApiFetch.mockResolvedValue(sampleSales);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("St. Mary's Parish")).toBeInTheDocument();
    });
    // First click shows confirmation
    const deleteButtons = screen.getAllByText("Delete");
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });
    expect(screen.getByText("Delete?")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    // Confirm
    mockApiFetch.mockResolvedValueOnce({}).mockResolvedValueOnce(sampleSales);
    await act(async () => {
      fireEvent.click(screen.getByText("Yes"));
    });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/sales/1", { method: "DELETE" });
  });

  it("cancels delete confirmation", async () => {
    mockApiFetch.mockResolvedValue(sampleSales);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("St. Mary's Parish")).toBeInTheDocument();
    });
    const deleteButtons = screen.getAllByText("Delete");
    await act(async () => {
      fireEvent.click(deleteButtons[0]);
    });
    expect(screen.getByText("Delete?")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByText("No"));
    });
    expect(screen.queryByText("Delete?")).not.toBeInTheDocument();
  });

  it("restores a deleted sale", async () => {
    mockApiFetch.mockResolvedValue(sampleSales);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("St. Mary's Parish")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Show Deleted"));
    });
    await waitFor(() => {
      expect(screen.getByText("Deleted Sale")).toBeInTheDocument();
    });
    mockApiFetch.mockResolvedValueOnce({}).mockResolvedValueOnce(sampleSales);
    await act(async () => {
      fireEvent.click(screen.getByText("Restore"));
    });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/sales/3/restore", { method: "POST" });
  });

  it("hides actions column for non-writable role", async () => {
    mockUseRole.mockReturnValue({ role: "member", isLoaded: true });
    mockApiFetch.mockResolvedValue(sampleSales);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("St. Mary's Parish")).toBeInTheDocument();
    });
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  it("renders table headers", async () => {
    mockApiFetch.mockResolvedValue(sampleSales);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("St. Mary's Parish")).toBeInTheDocument();
    });
    expect(screen.getByText("#")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Customer")).toBeInTheDocument();
    expect(screen.getByText("Items")).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("displays item count and formatted revenue", async () => {
    mockApiFetch.mockResolvedValue(sampleSales);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("St. Mary's Parish")).toBeInTheDocument();
    });
    // Sale 1 has saleId=1 and 1 item — both render "1", so use getAllByText
    const ones = screen.getAllByText("1");
    expect(ones.length).toBeGreaterThanOrEqual(2); // saleId + item count
    // Sale 2 has 0 items
    expect(screen.getByText("0")).toBeInTheDocument();
    // Formatted revenue
    expect(screen.getByText("$20.00")).toBeInTheDocument();
    expect(screen.getByText("$50.00")).toBeInTheDocument();
  });

  it("handles add failure from crud.create (catch branch)", async () => {
    // crud.create throws after setting actionError — the page catch swallows it
    mockApiFetch.mockResolvedValueOnce([]); // initial load
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Sale")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("+ Add Sale"));
    });
    const customerInput = screen.getByPlaceholderText("Customer");
    const dateInputEl = customerInput.closest(".grid")!.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInputEl, { target: { value: "2025-07-01" } });
    fireEvent.change(customerInput, { target: { value: "Customer" } });
    // Make the POST call fail — useCrud.create sets actionError then re-throws
    mockApiFetch.mockRejectedValueOnce(new Error("Create boom"));
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    // crud.create sets actionError internally, the page catch swallows the re-throw
    expect(screen.getByText("Create boom")).toBeInTheDocument();
    // Adding form should still be visible (not closed on error)
    expect(screen.getByPlaceholderText("Customer")).toBeInTheDocument();
  });

  it("handles edit save failure from crud.update (catch branch)", async () => {
    mockApiFetch.mockResolvedValue(sampleSales);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("St. Mary's Parish")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByText("Edit");
    await act(async () => {
      fireEvent.click(editButtons[0]);
    });
    // Make the PUT call fail
    mockApiFetch.mockRejectedValueOnce(new Error("Update boom"));
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    // crud.update sets actionError internally
    expect(screen.getByText("Update boom")).toBeInTheDocument();
  });

  it("saves edit with empty revenue (parseFloat || 0 branch)", async () => {
    mockApiFetch.mockResolvedValue(sampleSales);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByText("St. Mary's Parish")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByText("Edit");
    await act(async () => {
      fireEvent.click(editButtons[0]);
    });
    const revenueInput = screen.getByDisplayValue("20");
    fireEvent.change(revenueInput, { target: { value: "" } });
    mockApiFetch.mockResolvedValueOnce({}).mockResolvedValueOnce(sampleSales);
    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });
    const putCall = mockApiFetch.mock.calls.find(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("/api/sales/1") && (c[1] as Record<string, string>)?.method === "PUT"
    );
    expect(putCall).toBeDefined();
    const body = JSON.parse((putCall![1] as Record<string, string>).body);
    expect(body.revenue).toBe(0);
  });

  it("renders page heading", async () => {
    mockApiFetch.mockResolvedValue([]);
    render(<SalesPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Sales" })).toBeInTheDocument();
    });
  });
});
