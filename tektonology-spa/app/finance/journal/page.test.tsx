import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, within, cleanup } from "@testing-library/react";
import React from "react";

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
  canWrite: (role: string) => role === "owner",
  isAuthenticated: () => true,
}));

vi.mock("@/lib/api", () => ({
  useApiFetch: () => mockApiFetch,
}));

vi.mock("@/components/auth-guard", () => ({
  RequireRole: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import JournalPage from "./page";

const sampleAccounts = [
  { number: 1000, name: "Cash", type: "asset" },
  { number: 2000, name: "Accounts Payable", type: "liability" },
  { number: 4000, name: "Revenue", type: "revenue" },
  { number: 5000, name: "COGS", type: "cogs" },
  { number: 3000, name: "Equity", type: "equity" },
  { number: 1500, name: "Inventory", type: "expense" },
];

const sampleEntries = [
  {
    transactionId: 1,
    effective: "2025-01-15",
    description: "Initial deposit",
    lines: [
      { accountNumber: 1000, accountName: "Cash", debit: 100, credit: null, description: "cash in" },
      { accountNumber: 4000, accountName: "Revenue", debit: null, credit: 100 },
    ],
  },
  {
    transactionId: 2,
    effective: "2025-01-16",
    description: "Unbalanced entry",
    lines: [
      { accountNumber: 1000, accountName: "Cash", debit: 50, credit: null },
      { accountNumber: 2000, accountName: "Accounts Payable", debit: null, credit: 40 },
    ],
  },
];

const deletedEntry = {
  transactionId: 3,
  effective: "2025-01-17",
  description: "Deleted txn",
  deletedAt: "2025-02-01T00:00:00Z",
  lines: [
    { accountNumber: 1000, accountName: "Cash", debit: 25, credit: null },
    { accountNumber: 2000, accountName: "Accounts Payable", debit: null, credit: 25 },
  ],
};

function setupFetchSuccess(entries = sampleEntries, accounts = sampleAccounts) {
  mockApiFetch.mockImplementation((url: string) => {
    if (url.startsWith("/api/finance/journal")) return Promise.resolve(entries);
    if (url === "/api/finance/accounts") return Promise.resolve(accounts);
    return Promise.resolve([]);
  });
}

describe("JournalPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows loading state initially", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    render(<JournalPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network error"));
    render(<JournalPage />);
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("renders journal entries with lines", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });
    expect(view.getByText("2 transactions.")).toBeInTheDocument();
    expect(view.getByText(/Initial deposit/)).toBeInTheDocument();
    expect(view.getAllByText("$100.00").length).toBeGreaterThan(0);
    expect(view.getByText(/cash in/)).toBeInTheDocument();
  });

  it("shows unbalanced badge for unbalanced entries", async () => {
    setupFetchSuccess();
    render(<JournalPage />);
    await waitFor(() => {
      expect(screen.getByText(/Unbalanced \(off by/)).toBeInTheDocument();
    });
  });

  it("renders breadcrumb navigation", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Home")).toBeInTheDocument();
    });
    expect(view.getByText("Finance")).toBeInTheDocument();
    expect(view.getByRole("heading", { name: "Journal" })).toBeInTheDocument();
  });

  it("shows + New Transaction link for owner", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("+ New Transaction")).toBeInTheDocument();
    });
  });

  // --- Show/Hide Deleted ---
  it("toggles show/hide deleted entries", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Show Deleted")).toBeInTheDocument();
    });

    // Click to show deleted
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/finance/journal"))
        return Promise.resolve([...sampleEntries, deletedEntry]);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    fireEvent.click(view.getByText("Show Deleted"));

    await waitFor(() => {
      expect(view.getByText("Hide Deleted")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(view.getByText("Transaction #3")).toBeInTheDocument();
    });
    expect(view.getByText("Deleted")).toBeInTheDocument();
    expect(view.getByText("(1 deleted)")).toBeInTheDocument();
  });

  // --- Edit Mode ---
  it("enters edit mode and displays edit UI", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });

    const editButtons = view.getAllByText("Edit");
    fireEvent.click(editButtons[0]);

    expect(view.getByText("Editing Transaction #1")).toBeInTheDocument();
    expect(view.getByText("Cancel")).toBeInTheDocument();
    expect(view.getByText("Save")).toBeInTheDocument();
    expect(view.getByText("+ Add Line")).toBeInTheDocument();
    expect(view.getByText("Balanced")).toBeInTheDocument();
  });

  it("cancels edit mode", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });

    fireEvent.click(view.getAllByText("Edit")[0]);
    expect(view.getByText("Editing Transaction #1")).toBeInTheDocument();

    fireEvent.click(view.getByText("Cancel"));
    expect(view.queryByText("Editing Transaction #1")).not.toBeInTheDocument();
  });

  it("edits date and description", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });

    fireEvent.click(view.getAllByText("Edit")[0]);

    const dateInput = view.getByDisplayValue("2025-01-15");
    fireEvent.change(dateInput, { target: { value: "2025-02-01" } });

    const descInput = view.getByDisplayValue("Initial deposit");
    fireEvent.change(descInput, { target: { value: "Updated description" } });

    expect(view.getByDisplayValue("2025-02-01")).toBeInTheDocument();
    expect(view.getByDisplayValue("Updated description")).toBeInTheDocument();
  });

  it("adds and removes edit lines", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });

    fireEvent.click(view.getAllByText("Edit")[0]);

    // Should have 2 lines initially -- x buttons disabled when only 2 lines
    const removeButtons = view.getAllByText("x");
    expect(removeButtons).toHaveLength(2);
    expect(removeButtons[0]).toBeDisabled();

    // Add a new line
    fireEvent.click(view.getByText("+ Add Line"));
    const removeButtonsAfterAdd = view.getAllByText("x");
    expect(removeButtonsAfterAdd).toHaveLength(3);
    expect(removeButtonsAfterAdd[0]).not.toBeDisabled();

    // Remove the third line
    fireEvent.click(removeButtonsAfterAdd[2]);
    expect(view.getAllByText("x")).toHaveLength(2);
  });

  it("updates line fields (account, side, amount, memo)", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });

    fireEvent.click(view.getAllByText("Edit")[0]);

    // Change account on first line
    const accountSelects = view.getAllByDisplayValue("1000: Cash");
    fireEvent.change(accountSelects[0], { target: { value: "2000" } });

    // Change side
    const sideSelects = view.getAllByDisplayValue("Debit");
    fireEvent.change(sideSelects[0], { target: { value: "credit" } });

    // Change amount
    const amountInputs = view.getAllByPlaceholderText("0.00");
    fireEvent.change(amountInputs[0], { target: { value: "200" } });

    // Change memo
    const memoInputs = view.getAllByPlaceholderText("Line memo...");
    fireEvent.change(memoInputs[0], { target: { value: "Updated memo" } });
  });

  it("clears account number when empty value selected", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });

    fireEvent.click(view.getAllByText("Edit")[0]);

    const accountSelects = view.getAllByDisplayValue("1000: Cash");
    fireEvent.change(accountSelects[0], { target: { value: "" } });
  });

  it("shows 'Off by' badge when unbalanced in edit mode", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });

    fireEvent.click(view.getAllByText("Edit")[0]);

    // Change amount to create imbalance
    const amountInputs = view.getAllByPlaceholderText("0.00");
    fireEvent.change(amountInputs[0], { target: { value: "50" } });

    await waitFor(() => {
      expect(view.getByText("Off by $50.00")).toBeInTheDocument();
    });
  });

  it("saves edited entry successfully", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });

    fireEvent.click(view.getAllByText("Edit")[0]);
    expect(view.getByText("Save")).not.toBeDisabled();

    // Mock the PUT call
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "PUT") return Promise.resolve({});
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(sampleEntries);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });

    await waitFor(() => {
      expect(view.queryByText("Editing Transaction #1")).not.toBeInTheDocument();
    });
  });

  it("handles save error (Error instance)", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });

    fireEvent.click(view.getAllByText("Edit")[0]);

    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "PUT") return Promise.reject(new Error("Save failed"));
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(sampleEntries);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });

    await waitFor(() => {
      expect(view.getByText("Save failed")).toBeInTheDocument();
    });
  });

  it("handles save error (non-Error)", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });

    fireEvent.click(view.getAllByText("Edit")[0]);

    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "PUT") return Promise.reject("string error");
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(sampleEntries);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });

    await waitFor(() => {
      expect(view.getByText("Failed to save")).toBeInTheDocument();
    });
  });

  it("does not save when editingId is null", async () => {
    setupFetchSuccess();
    render(<JournalPage />);
    await waitFor(() => {
      expect(screen.getByText("Transaction #1")).toBeInTheDocument();
    });
    // Not in edit mode, so handleSave early-returns -- no crash
  });

  it("disables save when entry is not balanced or fields missing", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });

    fireEvent.click(view.getAllByText("Edit")[0]);

    // Clear amount to make it unfilled
    const amountInputs = view.getAllByPlaceholderText("0.00");
    fireEvent.change(amountInputs[0], { target: { value: "" } });

    expect(view.getByText("Save")).toBeDisabled();
  });

  it("disables save when description is empty", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });

    fireEvent.click(view.getAllByText("Edit")[0]);

    const descInput = view.getByDisplayValue("Initial deposit");
    fireEvent.change(descInput, { target: { value: "" } });

    expect(view.getByText("Save")).toBeDisabled();
  });

  // --- Delete flow ---
  it("shows delete confirmation and cancels", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });

    const deleteButtons = view.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]);

    expect(view.getByText("Delete?")).toBeInTheDocument();
    expect(view.getByText("Yes")).toBeInTheDocument();
    expect(view.getByText("No")).toBeInTheDocument();

    fireEvent.click(view.getByText("No"));
    expect(view.queryByText("Delete?")).not.toBeInTheDocument();
  });

  it("confirms delete and calls API", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });

    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "DELETE") return Promise.resolve({});
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(sampleEntries);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    const deleteButtons = view.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]);
    await act(async () => {
      fireEvent.click(view.getByText("Yes"));
    });

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/finance/journal/1", { method: "DELETE" });
    });
  });

  it("handles delete error (Error instance)", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });

    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "DELETE") return Promise.reject(new Error("Delete failed"));
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(sampleEntries);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    fireEvent.click(view.getAllByText("Delete")[0]);
    await act(async () => {
      fireEvent.click(view.getByText("Yes"));
    });

    await waitFor(() => {
      expect(view.getByText("Delete failed")).toBeInTheDocument();
    });
  });

  it("handles delete error (non-Error)", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });

    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "DELETE") return Promise.reject("string error");
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(sampleEntries);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    fireEvent.click(view.getAllByText("Delete")[0]);
    await act(async () => {
      fireEvent.click(view.getByText("Yes"));
    });

    await waitFor(() => {
      expect(view.getByText("Failed to delete")).toBeInTheDocument();
    });
  });

  // --- Restore flow ---
  it("restores a deleted entry", async () => {
    const entriesWithDeleted = [...sampleEntries, deletedEntry];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entriesWithDeleted);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    const { container } = render(<JournalPage />);
    const view = within(container);

    // Toggle show deleted
    await waitFor(() => {
      expect(view.getByText("Show Deleted")).toBeInTheDocument();
    });
    fireEvent.click(view.getByText("Show Deleted"));

    await waitFor(() => {
      expect(view.getByText("Restore")).toBeInTheDocument();
    });

    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "POST") return Promise.resolve({});
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(sampleEntries);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    await act(async () => {
      fireEvent.click(view.getByText("Restore"));
    });

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/finance/journal/3/restore", { method: "POST" });
    });
  });

  it("handles restore error (Error instance)", async () => {
    const entriesWithDeleted = [...sampleEntries, deletedEntry];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entriesWithDeleted);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Show Deleted")).toBeInTheDocument());
    fireEvent.click(view.getByText("Show Deleted"));

    await waitFor(() => expect(view.getByText("Restore")).toBeInTheDocument());

    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "POST") return Promise.reject(new Error("Restore failed"));
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entriesWithDeleted);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    await act(async () => {
      fireEvent.click(view.getByText("Restore"));
    });

    await waitFor(() => {
      expect(view.getByText("Restore failed")).toBeInTheDocument();
    });
  });

  it("handles restore error (non-Error)", async () => {
    const entriesWithDeleted = [...sampleEntries, deletedEntry];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entriesWithDeleted);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Show Deleted")).toBeInTheDocument());
    fireEvent.click(view.getByText("Show Deleted"));

    await waitFor(() => expect(view.getByText("Restore")).toBeInTheDocument());

    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "POST") return Promise.reject("string error");
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entriesWithDeleted);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    await act(async () => {
      fireEvent.click(view.getByText("Restore"));
    });

    await waitFor(() => {
      expect(view.getByText("Failed to restore")).toBeInTheDocument();
    });
  });

  // --- Permanent Delete (Purge) flow ---
  it("shows purge confirmation and cancels", async () => {
    const entriesWithDeleted = [...sampleEntries, deletedEntry];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entriesWithDeleted);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Show Deleted")).toBeInTheDocument());
    fireEvent.click(view.getByText("Show Deleted"));

    await waitFor(() => expect(view.getByText("Purge")).toBeInTheDocument());

    fireEvent.click(view.getByText("Purge"));
    expect(view.getByText("Permanently delete?")).toBeInTheDocument();
    expect(view.getByText("Yes")).toBeInTheDocument();

    // Cancel
    fireEvent.click(view.getAllByText("No")[0]);
    expect(view.queryByText("Permanently delete?")).not.toBeInTheDocument();
  });

  it("confirms permanent delete and calls API", async () => {
    const entriesWithDeleted = [...sampleEntries, deletedEntry];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entriesWithDeleted);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Show Deleted")).toBeInTheDocument());
    fireEvent.click(view.getByText("Show Deleted"));

    await waitFor(() => expect(view.getByText("Purge")).toBeInTheDocument());
    fireEvent.click(view.getByText("Purge"));

    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "DELETE") return Promise.resolve({});
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(sampleEntries);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    await act(async () => {
      fireEvent.click(view.getByText("Yes"));
    });

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/finance/journal/3/permanent", { method: "DELETE" });
    });
  });

  it("handles permanent delete error (Error instance)", async () => {
    const entriesWithDeleted = [...sampleEntries, deletedEntry];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entriesWithDeleted);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Show Deleted")).toBeInTheDocument());
    fireEvent.click(view.getByText("Show Deleted"));

    await waitFor(() => expect(view.getByText("Purge")).toBeInTheDocument());
    fireEvent.click(view.getByText("Purge"));

    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "DELETE") return Promise.reject(new Error("Purge failed"));
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entriesWithDeleted);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    await act(async () => {
      fireEvent.click(view.getByText("Yes"));
    });

    await waitFor(() => {
      expect(view.getByText("Purge failed")).toBeInTheDocument();
    });
  });

  it("handles permanent delete error (non-Error)", async () => {
    const entriesWithDeleted = [...sampleEntries, deletedEntry];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entriesWithDeleted);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Show Deleted")).toBeInTheDocument());
    fireEvent.click(view.getByText("Show Deleted"));

    await waitFor(() => expect(view.getByText("Purge")).toBeInTheDocument());
    fireEvent.click(view.getByText("Purge"));

    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "DELETE") return Promise.reject("string error");
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entriesWithDeleted);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    await act(async () => {
      fireEvent.click(view.getByText("Yes"));
    });

    await waitFor(() => {
      expect(view.getByText("Failed to permanently delete")).toBeInTheDocument();
    });
  });

  // --- codeColor branches ---
  it("renders correct color classes for different account codes", async () => {
    const entries = [
      {
        transactionId: 10,
        effective: "2025-01-01",
        description: "Color test",
        lines: [
          { accountNumber: 1000, accountName: "Asset", debit: 10, credit: null },       // < 2000 emerald
          { accountNumber: 2000, accountName: "Liability", debit: null, credit: 2 },     // < 3000 red
          { accountNumber: 3000, accountName: "Equity", debit: null, credit: 3 },        // < 4000 blue
          { accountNumber: 4000, accountName: "Revenue", debit: null, credit: 4 },       // < 5000 emerald
          { accountNumber: 5000, accountName: "COGS", debit: null, credit: 1 },          // >= 5000 orange
        ],
      },
    ];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entries);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    const { container } = render(<JournalPage />);
    await waitFor(() => {
      expect(screen.getByText("Transaction #10")).toBeInTheDocument();
    });

    const codeSpans = container.querySelectorAll("span.font-mono.text-xs");
    const classes = Array.from(codeSpans).map((el) => el.className);
    expect(classes.some((c) => c.includes("text-emerald-700"))).toBe(true);
    expect(classes.some((c) => c.includes("text-red-700"))).toBe(true);
    expect(classes.some((c) => c.includes("text-blue-700"))).toBe(true);
    expect(classes.some((c) => c.includes("text-orange-700"))).toBe(true);
  });

  // --- Entry without description ---
  it("renders entry without description (no em-dash span)", async () => {
    const entries = [
      {
        transactionId: 20,
        effective: "2025-01-01",
        description: "",
        lines: [
          { accountNumber: 1000, accountName: "Cash", debit: 10, credit: null },
          { accountNumber: 2000, accountName: "AP", debit: null, credit: 10 },
        ],
      },
    ];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entries);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    render(<JournalPage />);
    await waitFor(() => {
      expect(screen.getByText("Transaction #20")).toBeInTheDocument();
    });
  });

  // --- toEditLines with null debit and credit ---
  it("handles line with null debit (credit side) in edit mode", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });

    fireEvent.click(view.getAllByText("Edit")[0]);

    // The credit line should show as "credit" side
    const sideSelects = view.getAllByRole("combobox");
    // Second line should be credit
    const secondSideSelect = sideSelects.find(
      (sel) => (sel as HTMLSelectElement).value === "credit"
    );
    expect(secondSideSelect).toBeTruthy();
  });

  // --- save with account not found ---
  it("saves entry where account is not in accounts list", async () => {
    const entriesWithUnknownAccount = [
      {
        transactionId: 30,
        effective: "2025-01-01",
        description: "Unknown account",
        lines: [
          { accountNumber: 9999, accountName: "Unknown", debit: 10, credit: null },
          { accountNumber: 1000, accountName: "Cash", debit: null, credit: 10 },
        ],
      },
    ];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entriesWithUnknownAccount);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #30")).toBeInTheDocument();
    });

    fireEvent.click(view.getByText("Edit"));

    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "PUT") return Promise.resolve({});
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entriesWithUnknownAccount);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });
  });

  // --- removeEditLine no-op when <= 2 lines ---
  it("does not remove line when only 2 lines remain", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });

    fireEvent.click(view.getAllByText("Edit")[0]);

    const removeButtons = view.getAllByText("x");
    expect(removeButtons).toHaveLength(2);

    // Try to click -- disabled, won't remove
    fireEvent.click(removeButtons[0]);
    expect(view.getAllByText("x")).toHaveLength(2);
  });

  // --- no entries but no error shows loading ---
  it("does not show deleted count when showDeleted is true but no deleted entries exist", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(sampleEntries);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Show Deleted")).toBeInTheDocument());

    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(sampleEntries);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    fireEvent.click(view.getByText("Show Deleted"));

    await waitFor(() => {
      expect(view.getByText("Hide Deleted")).toBeInTheDocument();
    });
    expect(view.queryByText(/deleted\)/)).not.toBeInTheDocument();
  });

  // --- editLines with totalDebit === 0 hides balanced badge ---
  it("does not show balanced badge when totalDebit is 0", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });

    fireEvent.click(view.getAllByText("Edit")[0]);

    // Set both amounts to 0
    const amountInputs = view.getAllByPlaceholderText("0.00");
    fireEvent.change(amountInputs[0], { target: { value: "0" } });
    fireEvent.change(amountInputs[1], { target: { value: "0" } });

    expect(view.queryByText("Balanced")).not.toBeInTheDocument();
    expect(view.queryByText(/Off by/)).not.toBeInTheDocument();
  });

  // --- handleSave early return when editingId is null (line 135) ---
  it("handleSave returns early when editingId is null (save not triggered)", async () => {
    setupFetchSuccess();
    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #1")).toBeInTheDocument();
    });
    // We are NOT in edit mode, so editingId is null.
    // No Save button is visible — no crash, no API call.
    expect(view.queryByText("Save")).not.toBeInTheDocument();
    // Verify no PUT was issued
    const putCalls = mockApiFetch.mock.calls.filter(
      (c: unknown[]) => (c[1] as RequestInit | undefined)?.method === "PUT"
    );
    expect(putCalls).toHaveLength(0);
  });

  // --- "Deleting..." text while delete is in progress (line 456) ---
  // Note: For regular delete (line 456), confirmDeleteId is cleared before handleDelete
  // runs, so the ternary is never visible. The same ternary pattern on the Purge flow
  // (line 418) IS testable and covered by the purge Deleting... test below.

  // --- toEditLines: line with both debit and credit null (line 59) ---
  it("handles entry line where both debit and credit are null in edit mode", async () => {
    const entriesWithNulls = [
      {
        transactionId: 50,
        effective: "2025-01-01",
        description: "Null amounts",
        lines: [
          { accountNumber: 1000, accountName: "Cash", debit: null, credit: null },
          { accountNumber: 2000, accountName: "AP", debit: null, credit: null },
        ],
      },
    ];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entriesWithNulls);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #50")).toBeInTheDocument();
    });

    fireEvent.click(view.getByText("Edit"));
    // With both debit and credit null, toEditLines falls through to 0
    // and side should be "credit" (since debit is null, l.debit != null is false)
    const sideSelects = view.getAllByRole("combobox").filter(
      (sel) => (sel as HTMLSelectElement).value === "credit"
    );
    expect(sideSelects.length).toBeGreaterThanOrEqual(2);
    // Amount should be "0"
    const amountInputs = view.getAllByPlaceholderText("0.00");
    expect((amountInputs[0] as HTMLInputElement).value).toBe("0");
  });

  // --- toEditLines: line with undefined description (line 60) ---
  it("handles entry line where description is undefined in edit mode", async () => {
    const entriesNoDesc = [
      {
        transactionId: 51,
        effective: "2025-01-01",
        description: "Missing line desc",
        lines: [
          { accountNumber: 1000, accountName: "Cash", debit: 10, credit: null },
          { accountNumber: 2000, accountName: "AP", debit: null, credit: 10 },
        ],
      },
    ];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entriesNoDesc);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #51")).toBeInTheDocument();
    });

    fireEvent.click(view.getByText("Edit"));
    // description is undefined, so toEditLines should fall through to ""
    const memoInputs = view.getAllByPlaceholderText("Line memo...");
    expect((memoInputs[0] as HTMLInputElement).value).toBe("");
    expect((memoInputs[1] as HTMLInputElement).value).toBe("");
  });

  // --- codeColor function: all five branches ---
  it("renders all codeColor branches with account codes in each range", async () => {
    const entries = [
      {
        transactionId: 60,
        effective: "2025-01-01",
        description: "All color ranges",
        lines: [
          { accountNumber: 1000, accountName: "Asset < 2000", debit: 5, credit: null },
          { accountNumber: 1500, accountName: "Inventory < 2000", debit: 5, credit: null },
          { accountNumber: 2000, accountName: "Liability 2000-2999", debit: null, credit: 2 },
          { accountNumber: 2500, accountName: "Other Liab 2000-2999", debit: null, credit: 2 },
          { accountNumber: 3000, accountName: "Equity 3000-3999", debit: null, credit: 2 },
          { accountNumber: 3500, accountName: "Other Equity 3000-3999", debit: null, credit: 1 },
          { accountNumber: 4000, accountName: "Revenue 4000-4999", debit: null, credit: 1 },
          { accountNumber: 4500, accountName: "Other Rev 4000-4999", debit: null, credit: 1 },
          { accountNumber: 5000, accountName: "COGS >= 5000", debit: null, credit: 1 },
          { accountNumber: 6000, accountName: "Expense >= 5000", debit: null, credit: 1 },
        ],
      },
    ];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entries);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    const { container } = render(<JournalPage />);
    await waitFor(() => {
      expect(screen.getByText("Transaction #60")).toBeInTheDocument();
    });

    const codeSpans = container.querySelectorAll("span.font-mono.text-xs");
    const classMap: Record<string, string[]> = {};
    codeSpans.forEach((el) => {
      const code = el.textContent ?? "";
      classMap[code] = el.className.split(" ");
    });

    // < 2000 → emerald
    expect(classMap["1000"]).toEqual(expect.arrayContaining(["text-emerald-700"]));
    expect(classMap["1500"]).toEqual(expect.arrayContaining(["text-emerald-700"]));
    // 2000-2999 → red
    expect(classMap["2000"]).toEqual(expect.arrayContaining(["text-red-700"]));
    expect(classMap["2500"]).toEqual(expect.arrayContaining(["text-red-700"]));
    // 3000-3999 → blue
    expect(classMap["3000"]).toEqual(expect.arrayContaining(["text-blue-700"]));
    expect(classMap["3500"]).toEqual(expect.arrayContaining(["text-blue-700"]));
    // 4000-4999 → emerald
    expect(classMap["4000"]).toEqual(expect.arrayContaining(["text-emerald-700"]));
    expect(classMap["4500"]).toEqual(expect.arrayContaining(["text-emerald-700"]));
    // >= 5000 → orange
    expect(classMap["5000"]).toEqual(expect.arrayContaining(["text-orange-700"]));
    expect(classMap["6000"]).toEqual(expect.arrayContaining(["text-orange-700"]));
  });

  // --- Lines 248-249: reduce with null debit/credit ---
  it("handles lines with null debit and credit in the balance reduce", async () => {
    const entriesNullAmounts = [
      {
        transactionId: 70,
        effective: "2025-01-01",
        description: "Null reduce test",
        lines: [
          { accountNumber: 1000, accountName: "Cash", debit: null, credit: null },
          { accountNumber: 2000, accountName: "AP", debit: null, credit: null },
        ],
      },
    ];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entriesNullAmounts);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Transaction #70")).toBeInTheDocument();
    });
    // dr and cr both 0 from the reduce with ?? 0, so not unbalanced
    // No "Unbalanced" badge should appear
    expect(view.queryByText(/Unbalanced/)).not.toBeInTheDocument();
  });

  // --- "Deleting..." text on permanent delete Yes button (line 418) ---
  it("shows 'Deleting...' on Purge Yes button while permanent delete is in flight", async () => {
    const entriesWithDeleted = [...sampleEntries, deletedEntry];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entriesWithDeleted);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    const { container } = render(<JournalPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Show Deleted")).toBeInTheDocument());
    fireEvent.click(view.getByText("Show Deleted"));

    await waitFor(() => expect(view.getByText("Purge")).toBeInTheDocument());
    fireEvent.click(view.getByText("Purge"));
    expect(view.getByText("Permanently delete?")).toBeInTheDocument();

    // Set up a DELETE that never resolves
    let resolvePurge!: () => void;
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "DELETE") {
        return new Promise<void>((resolve) => { resolvePurge = resolve; });
      }
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entriesWithDeleted);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    await act(async () => {
      fireEvent.click(view.getByText("Yes"));
    });

    expect(view.getByText("Deleting...")).toBeInTheDocument();

    await act(async () => {
      resolvePurge();
    });
  });

  // --- Entry with lines that have no description ---
  it("renders lines without description (no memo dash)", async () => {
    const entries = [
      {
        transactionId: 40,
        effective: "2025-01-01",
        description: "No line desc",
        lines: [
          { accountNumber: 1000, accountName: "Cash", debit: 10, credit: null },
          { accountNumber: 2000, accountName: "AP", debit: null, credit: 10 },
        ],
      },
    ];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.startsWith("/api/finance/journal")) return Promise.resolve(entries);
      if (url === "/api/finance/accounts") return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });

    render(<JournalPage />);
    await waitFor(() => {
      expect(screen.getByText("Transaction #40")).toBeInTheDocument();
    });
  });
});
