import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, within, cleanup } from "@testing-library/react";
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
}));

vi.mock("@/components/auth-guard", () => ({
  RequireRole: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import ChartOfAccountsPage from "./page";

const sampleAccounts = [
  { number: 1000, name: "Cash", type: "asset", balance: 500 },
  { number: 2000, name: "Accounts Payable", type: "liability", balance: 200 },
  { number: 3000, name: "Retained Earnings", type: "equity", balance: 300 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRole.mockReturnValue({ role: "owner", isLoaded: true });
});

afterEach(() => {
  cleanup();
});

describe("ChartOfAccountsPage", () => {
  // -- Loading / Error states --

  it("shows loading state while fetching", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    render(<ChartOfAccountsPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    mockApiFetch.mockRejectedValue(new Error("Server error"));
    render(<ChartOfAccountsPage />);
    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("renders account list after loading", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Cash")).toBeInTheDocument();
    });
    expect(view.getByText("3 accounts. Click column headers to sort.")).toBeInTheDocument();
    expect(view.getByText("Accounts Payable")).toBeInTheDocument();
    expect(view.getByText("Retained Earnings")).toBeInTheDocument();
  });

  it("renders breadcrumb navigation", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());
    expect(view.getByText("Home")).toBeInTheDocument();
    expect(view.getByText("Finance")).toBeInTheDocument();
    expect(view.getByRole("heading", { name: "Chart of Accounts" })).toBeInTheDocument();
  });

  // -- Sorting --

  it("sorts by name when name header is clicked", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    // Click Name header to sort ascending by name
    const headers = view.getAllByRole("columnheader");
    fireEvent.click(headers[1]); // Name column
    const rows = view.getAllByRole("row");
    // First data row (index 1) should be "Accounts Payable" (alphabetically first)
    expect(rows[1]).toHaveTextContent("Accounts Payable");
  });

  it("toggles sort direction on same column click", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    // Default sort is number asc, click number header again to toggle to desc
    const headers = view.getAllByRole("columnheader");
    fireEvent.click(headers[0]); // Code column (already active) → desc
    // Now desc -- first data row should be 3000
    const rows = view.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("3000");

    // Click again to toggle back to asc
    fireEvent.click(headers[0]); // desc → asc
    const rows2 = view.getAllByRole("row");
    expect(rows2[1]).toHaveTextContent("1000");
  });

  it("sorts by type column", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    const headers = view.getAllByRole("columnheader");
    fireEvent.click(headers[2]); // Type column
    const rows = view.getAllByRole("row");
    // asc by type: "asset" < "equity" < "liability"
    expect(rows[1]).toHaveTextContent("Cash");
    expect(rows[2]).toHaveTextContent("Retained Earnings");
    expect(rows[3]).toHaveTextContent("Accounts Payable");
  });

  it("sorts by balance column", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    const headers = view.getAllByRole("columnheader");
    fireEvent.click(headers[3]); // Balance column
    const rows = view.getAllByRole("row");
    // asc by balance: 200, 300, 500
    expect(rows[1]).toHaveTextContent("Accounts Payable");
    expect(rows[2]).toHaveTextContent("Retained Earnings");
    expect(rows[3]).toHaveTextContent("Cash");
  });

  it("sorts by name with equal values returning 0", async () => {
    const dupeNameAccounts = [
      { number: 1000, name: "Alpha", type: "asset", balance: 100 },
      { number: 2000, name: "Alpha", type: "liability", balance: 200 },
    ];
    mockApiFetch.mockResolvedValue(dupeNameAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getAllByText("Alpha")).toHaveLength(2));

    const headers = view.getAllByRole("columnheader");
    fireEvent.click(headers[1]); // Name column
    // Both are "Alpha" so order is stable (returns 0)
    const rows = view.getAllByRole("row");
    expect(rows).toHaveLength(3); // header + 2 data rows
  });

  // -- SortIcon --

  it("shows inactive sort icon for non-sorted columns", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());
    // Default sorted by number, so name column should show the neutral icon
    // The up arrow is shown for the active sorted column
    expect(view.getByText("\u25B2")).toBeInTheDocument(); // asc arrow for active column
  });

  // -- Auditor (read-only) --

  it("hides action buttons and add button for auditor", async () => {
    mockUseRole.mockReturnValue({ role: "auditor", isLoaded: true });
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());
    expect(view.queryByText("+ Add Account")).not.toBeInTheDocument();
    expect(view.queryByText("Edit")).not.toBeInTheDocument();
    expect(view.queryByText("Delete")).not.toBeInTheDocument();
  });

  // -- Edit flow --

  it("enters edit mode and cancels", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    // Click Edit on first row
    const editButtons = view.getAllByText("Edit");
    fireEvent.click(editButtons[0]);
    // Should show Save and Cancel buttons
    expect(view.getByText("Save")).toBeInTheDocument();
    expect(view.getByText("Cancel")).toBeInTheDocument();
    // Cancel
    fireEvent.click(view.getByText("Cancel"));
    expect(view.queryByText("Save")).not.toBeInTheDocument();
  });

  it("saves edit successfully", async () => {
    let callCount = 0;
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "PUT") return Promise.resolve({});
      callCount++;
      return Promise.resolve(sampleAccounts);
    });
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    const editButtons = view.getAllByText("Edit");
    fireEvent.click(editButtons[0]);

    // Change the name
    const nameInput = view.getByDisplayValue("Cash");
    fireEvent.change(nameInput, { target: { value: "Petty Cash" } });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/finance/accounts/1000",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("shows validation error for non-positive account code", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    fireEvent.click(view.getAllByText("Edit")[0]);
    const numInput = view.getByDisplayValue("1000");
    fireEvent.change(numInput, { target: { value: "0" } });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });
    expect(view.getByText("Account code must be a positive integer")).toBeInTheDocument();
  });

  it("shows validation error for NaN account code", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    fireEvent.click(view.getAllByText("Edit")[0]);
    const numInput = view.getByDisplayValue("1000");
    fireEvent.change(numInput, { target: { value: "abc" } });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });
    expect(view.getByText("Account code must be a positive integer")).toBeInTheDocument();
  });

  it("shows validation error for empty name", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    fireEvent.click(view.getAllByText("Edit")[0]);
    const nameInput = view.getByDisplayValue("Cash");
    fireEvent.change(nameInput, { target: { value: "" } });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });
    expect(view.getByText("Account name is required")).toBeInTheDocument();
  });

  it("shows validation error for duplicate account code", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    fireEvent.click(view.getAllByText("Edit")[0]);
    const numInput = view.getByDisplayValue("1000");
    fireEvent.change(numInput, { target: { value: "2000" } });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });
    expect(view.getByText("Account code 2000 already exists")).toBeInTheDocument();
  });

  it("shows validation error for duplicate account name on edit", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    fireEvent.click(view.getAllByText("Edit")[0]);
    const nameInput = view.getByDisplayValue("Cash");
    fireEvent.change(nameInput, { target: { value: "Accounts Payable" } });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });
    expect(view.getByText('Account name "Accounts Payable" already exists')).toBeInTheDocument();
  });

  it("shows API error on save failure", async () => {
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "PUT") return Promise.reject(new Error("Conflict"));
      return Promise.resolve(sampleAccounts);
    });
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    fireEvent.click(view.getAllByText("Edit")[0]);
    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });
    expect(view.getByText("Conflict")).toBeInTheDocument();
  });

  it("shows generic error on save failure with non-Error", async () => {
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "PUT") return Promise.reject("something");
      return Promise.resolve(sampleAccounts);
    });
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    fireEvent.click(view.getAllByText("Edit")[0]);
    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });
    expect(view.getByText("Failed to save")).toBeInTheDocument();
  });

  it("changes type in edit mode", async () => {
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "PUT") return Promise.resolve({});
      return Promise.resolve(sampleAccounts);
    });
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    fireEvent.click(view.getAllByText("Edit")[0]);
    // Select shows "Asset" text for value="asset"
    const typeSelect = view.getByDisplayValue("Asset");
    fireEvent.change(typeSelect, { target: { value: "expense" } });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/finance/accounts/1000",
      expect.objectContaining({
        body: expect.stringContaining('"type":"expense"'),
      }),
    );
  });

  // -- Delete flow --

  it("deletes account after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "DELETE") return Promise.resolve({});
      return Promise.resolve(sampleAccounts);
    });
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(view.getAllByText("Delete")[0]);
    });
    expect(window.confirm).toHaveBeenCalledWith("Delete account 1000: Cash?");
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/finance/accounts/1000",
      expect.objectContaining({ method: "DELETE" }),
    );
    vi.restoreAllMocks();
  });

  it("cancels delete when confirm is declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(view.getAllByText("Delete")[0]);
    });
    // Should not have called DELETE
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/finance/accounts/1000"),
      expect.objectContaining({ method: "DELETE" }),
    );
    vi.restoreAllMocks();
  });

  it("shows API error on delete failure", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "DELETE") return Promise.reject(new Error("Cannot delete"));
      return Promise.resolve(sampleAccounts);
    });
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(view.getAllByText("Delete")[0]);
    });
    expect(view.getByText("Cannot delete")).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("shows generic error on delete failure with non-Error", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "DELETE") return Promise.reject("oops");
      return Promise.resolve(sampleAccounts);
    });
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(view.getAllByText("Delete")[0]);
    });
    expect(view.getByText("Failed to delete")).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  // -- Add account flow --

  it("opens and cancels add account form", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    fireEvent.click(view.getByText("+ Add Account"));
    expect(view.getByPlaceholderText("1101")).toBeInTheDocument();
    expect(view.getByPlaceholderText("Account name")).toBeInTheDocument();

    // Cancel hides the form
    fireEvent.click(view.getByText("Cancel"));
    expect(view.queryByPlaceholderText("1101")).not.toBeInTheDocument();
  });

  it("adds account successfully", async () => {
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "POST") return Promise.resolve({});
      return Promise.resolve(sampleAccounts);
    });
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    fireEvent.click(view.getByText("+ Add Account"));
    fireEvent.change(view.getByPlaceholderText("1101"), { target: { value: "4000" } });
    fireEvent.change(view.getByPlaceholderText("Account name"), { target: { value: "Revenue" } });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/finance/accounts",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows validation error for non-positive code on add", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    fireEvent.click(view.getByText("+ Add Account"));
    fireEvent.change(view.getByPlaceholderText("1101"), { target: { value: "-1" } });
    fireEvent.change(view.getByPlaceholderText("Account name"), { target: { value: "Test" } });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });
    expect(view.getByText("Account code must be a positive integer")).toBeInTheDocument();
  });

  it("shows validation error for NaN code on add", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    fireEvent.click(view.getByText("+ Add Account"));
    fireEvent.change(view.getByPlaceholderText("1101"), { target: { value: "" } });
    fireEvent.change(view.getByPlaceholderText("Account name"), { target: { value: "Test" } });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });
    expect(view.getByText("Account code must be a positive integer")).toBeInTheDocument();
  });

  it("shows validation error for empty name on add", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    fireEvent.click(view.getByText("+ Add Account"));
    fireEvent.change(view.getByPlaceholderText("1101"), { target: { value: "4000" } });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });
    expect(view.getByText("Account name is required")).toBeInTheDocument();
  });

  it("shows validation error for duplicate code on add", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    fireEvent.click(view.getByText("+ Add Account"));
    fireEvent.change(view.getByPlaceholderText("1101"), { target: { value: "1000" } });
    fireEvent.change(view.getByPlaceholderText("Account name"), { target: { value: "New Acct" } });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });
    expect(view.getByText("Account code 1000 already exists")).toBeInTheDocument();
  });

  it("shows validation error for duplicate name on add", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    fireEvent.click(view.getByText("+ Add Account"));
    fireEvent.change(view.getByPlaceholderText("1101"), { target: { value: "4000" } });
    fireEvent.change(view.getByPlaceholderText("Account name"), { target: { value: "Cash" } });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });
    expect(view.getByText('Account name "Cash" already exists')).toBeInTheDocument();
  });

  it("shows API error on add failure", async () => {
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "POST") return Promise.reject(new Error("Duplicate key"));
      return Promise.resolve(sampleAccounts);
    });
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    fireEvent.click(view.getByText("+ Add Account"));
    fireEvent.change(view.getByPlaceholderText("1101"), { target: { value: "4000" } });
    fireEvent.change(view.getByPlaceholderText("Account name"), { target: { value: "Revenue" } });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });
    expect(view.getByText("Duplicate key")).toBeInTheDocument();
  });

  it("shows generic error on add failure with non-Error", async () => {
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "POST") return Promise.reject(42);
      return Promise.resolve(sampleAccounts);
    });
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    fireEvent.click(view.getByText("+ Add Account"));
    fireEvent.change(view.getByPlaceholderText("1101"), { target: { value: "4000" } });
    fireEvent.change(view.getByPlaceholderText("Account name"), { target: { value: "Revenue" } });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });
    expect(view.getByText("Failed to add")).toBeInTheDocument();
  });

  it("changes new row type via select", async () => {
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === "POST") return Promise.resolve({});
      return Promise.resolve(sampleAccounts);
    });
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    fireEvent.click(view.getByText("+ Add Account"));
    fireEvent.change(view.getByPlaceholderText("1101"), { target: { value: "5000" } });
    fireEvent.change(view.getByPlaceholderText("Account name"), { target: { value: "COGS" } });
    // Change type from default "asset" to "cogs"
    const selects = view.getAllByRole("combobox");
    const newRowSelect = selects[0]; // The add row select comes first in DOM
    fireEvent.change(newRowSelect, { target: { value: "cogs" } });

    await act(async () => {
      fireEvent.click(view.getByText("Save"));
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/finance/accounts",
      expect.objectContaining({
        body: expect.stringContaining('"type":"cogs"'),
      }),
    );
  });

  // -- Unknown type rendering --

  it("renders unknown type with fallback", async () => {
    const accountsWithUnknownType = [
      { number: 9999, name: "Mystery", type: "unknown_type", balance: 0 },
    ];
    mockApiFetch.mockResolvedValue(accountsWithUnknownType);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Mystery")).toBeInTheDocument());
    // Should render the raw type string since typeLabels won't have it
    expect(view.getByText("unknown_type")).toBeInTheDocument();
  });

  // -- Add button hidden while adding --

  it("hides add button while add row is visible", async () => {
    mockApiFetch.mockResolvedValue(sampleAccounts);
    const { container } = render(<ChartOfAccountsPage />);
    const view = within(container);
    await waitFor(() => expect(view.getByText("Cash")).toBeInTheDocument());

    fireEvent.click(view.getByText("+ Add Account"));
    expect(view.queryByText("+ Add Account")).not.toBeInTheDocument();
  });
});
