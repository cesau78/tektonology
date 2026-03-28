import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within, cleanup } from "@testing-library/react";
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

vi.mock("next/navigation", () => ({
  useParams: () => mockParams,
}));

let mockParams: Record<string, string> = { transactionId: "1" };

import TransactionDetailPage from "./page";

const sampleEntries = [
  {
    transactionId: 1,
    effective: "2025-06-15",
    description: "Filament purchase",
    lines: [
      { accountNumber: 1000, accountName: "Cash", debit: null, credit: 25.0, description: "PLA spool" },
      { accountNumber: 5100, accountName: "Supplies Expense", debit: 25.0, credit: null, description: null },
    ],
  },
  {
    transactionId: 2,
    effective: "2025-06-16",
    description: "Service revenue",
    lines: [
      { accountNumber: 1000, accountName: "Cash", debit: 100.0, credit: null, description: null },
      { accountNumber: 4000, accountName: "Service Revenue", debit: null, credit: 100.0, description: "Consulting" },
    ],
  },
];

const unbalancedEntry = [
  {
    transactionId: 1,
    effective: "2025-06-15",
    description: "Bad entry",
    lines: [
      { accountNumber: 1000, accountName: "Cash", debit: 50.0, credit: null, description: null },
      { accountNumber: 2500, accountName: "Loans Payable", debit: null, credit: 30.0, description: null },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRole.mockReturnValue({ role: "owner", isLoaded: true });
  mockParams = { transactionId: "1" };
});

afterEach(() => {
  cleanup();
});

describe("TransactionDetailPage", () => {
  // -- Loading / Error states --

  it("shows loading state while fetching", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    render(<TransactionDetailPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    mockApiFetch.mockRejectedValue(new Error("Server error"));
    render(<TransactionDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("shows 'Transaction not found' when transactionId doesn't match", async () => {
    mockParams = { transactionId: "999" };
    mockApiFetch.mockResolvedValue(sampleEntries);
    render(<TransactionDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Transaction not found")).toBeInTheDocument();
    });
  });

  it("shows 'Invalid transaction ID' for NaN params", async () => {
    mockParams = { transactionId: "abc" };
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    render(<TransactionDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Invalid transaction ID")).toBeInTheDocument();
    });
    // apiFetch should not have been called for invalid ID
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  // -- Rendered content --

  it("renders transaction header with ID, description, and date", async () => {
    mockApiFetch.mockResolvedValue(sampleEntries);
    const { container } = render(<TransactionDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText(/Transaction #1/)).toBeInTheDocument();
    });
    expect(view.getByText(/Filament purchase/)).toBeInTheDocument();
    expect(view.getByText("2025-06-15")).toBeInTheDocument();
  });

  it("renders breadcrumb navigation", async () => {
    mockApiFetch.mockResolvedValue(sampleEntries);
    const { container } = render(<TransactionDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText(/Transaction #1/)).toBeInTheDocument();
    });
    expect(view.getByText("Home")).toBeInTheDocument();
    expect(view.getByText("Finance")).toBeInTheDocument();
    expect(view.getByText("Journal")).toBeInTheDocument();
  });

  it("renders line items table with Account, Debit, Credit, Memo columns", async () => {
    mockApiFetch.mockResolvedValue(sampleEntries);
    const { container } = render(<TransactionDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Cash")).toBeInTheDocument();
    });
    const headers = view.getAllByRole("columnheader");
    expect(headers[0]).toHaveTextContent("Account");
    expect(headers[1]).toHaveTextContent("Debit");
    expect(headers[2]).toHaveTextContent("Credit");
    expect(headers[3]).toHaveTextContent("Memo");
  });

  it("account numbers and names link to /finance/accounts/{accountNumber}", async () => {
    mockApiFetch.mockResolvedValue(sampleEntries);
    const { container } = render(<TransactionDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Cash")).toBeInTheDocument();
    });
    const links = view.getAllByRole("link");
    const cashLinks = links.filter(
      (l) => l.getAttribute("href") === "/finance/accounts/1000"
    );
    // Two links per line: account number and account name
    expect(cashLinks.length).toBe(2);
    const expenseLinks = links.filter(
      (l) => l.getAttribute("href") === "/finance/accounts/5100"
    );
    expect(expenseLinks.length).toBe(2);
  });

  it("shows total debits and credits", async () => {
    mockApiFetch.mockResolvedValue(sampleEntries);
    const { container } = render(<TransactionDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Cash")).toBeInTheDocument();
    });
    expect(view.getByText(/Total Debits:/)).toBeInTheDocument();
    expect(view.getByText(/Total Credits:/)).toBeInTheDocument();
    // $25.00 debits and $25.00 credits for transaction 1
    const monos = view.getAllByText("$25.00");
    expect(monos.length).toBeGreaterThanOrEqual(2);
  });

  // -- Unbalanced / Balanced --

  it("shows unbalanced warning for unbalanced entry", async () => {
    mockApiFetch.mockResolvedValue(unbalancedEntry);
    const { container } = render(<TransactionDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Cash")).toBeInTheDocument();
    });
    expect(view.getByText(/Unbalanced/)).toBeInTheDocument();
    expect(view.getByText(/off by \$20\.00/)).toBeInTheDocument();
  });

  it("balanced entry does not show unbalanced warning", async () => {
    mockApiFetch.mockResolvedValue(sampleEntries);
    const { container } = render(<TransactionDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Cash")).toBeInTheDocument();
    });
    expect(view.queryByText(/Unbalanced/)).not.toBeInTheDocument();
  });

  // -- Null debit/credit and description --

  it("lines with null debit show empty debit cell", async () => {
    mockApiFetch.mockResolvedValue(sampleEntries);
    const { container } = render(<TransactionDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Cash")).toBeInTheDocument();
    });
    // Cash line: debit is null, credit is $25.00
    const rows = view.getAllByRole("row");
    // Row 0 is header, row 1 is Cash line (null debit), row 2 is Supplies (null credit)
    const cashCells = within(rows[1]).getAllByRole("cell");
    // debit cell (index 1) should be empty
    expect(cashCells[1].textContent).toBe("");
    // credit cell (index 2) should have value
    expect(cashCells[2].textContent).toBe("$25.00");
  });

  it("lines with null credit show empty credit cell", async () => {
    mockApiFetch.mockResolvedValue(sampleEntries);
    const { container } = render(<TransactionDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Cash")).toBeInTheDocument();
    });
    const rows = view.getAllByRole("row");
    // Row 2 is Supplies Expense line (null credit)
    const suppliesCells = within(rows[2]).getAllByRole("cell");
    expect(suppliesCells[1].textContent).toBe("$25.00");
    expect(suppliesCells[2].textContent).toBe("");
  });

  it("lines with description show in memo column, null descriptions show empty", async () => {
    mockApiFetch.mockResolvedValue(sampleEntries);
    const { container } = render(<TransactionDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Cash")).toBeInTheDocument();
    });
    const rows = view.getAllByRole("row");
    // Cash line has description "PLA spool"
    const cashCells = within(rows[1]).getAllByRole("cell");
    expect(cashCells[3].textContent).toBe("PLA spool");
    // Supplies Expense line has null description
    const suppliesCells = within(rows[2]).getAllByRole("cell");
    expect(suppliesCells[3].textContent).toBe("");
  });

  // -- codeColor function --

  it("applies correct color classes for different account number ranges", async () => {
    const colorEntries = [
      {
        transactionId: 1,
        effective: "2025-01-01",
        description: "Color test",
        lines: [
          { accountNumber: 1000, accountName: "Asset", debit: 10, credit: null, description: null },
          { accountNumber: 2000, accountName: "Liability", debit: null, credit: 2, description: null },
          { accountNumber: 3000, accountName: "Equity", debit: null, credit: 3, description: null },
          { accountNumber: 4000, accountName: "Revenue", debit: null, credit: 4, description: null },
          { accountNumber: 5000, accountName: "Expense", debit: null, credit: 1, description: null },
        ],
      },
    ];
    mockApiFetch.mockResolvedValue(colorEntries);
    const { container } = render(<TransactionDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Asset")).toBeInTheDocument();
    });

    // <2000 → text-emerald-700
    const code1000 = view.getByText("1000");
    expect(code1000.className).toContain("text-emerald-700");

    // >=2000 <3000 → text-red-700
    const code2000 = view.getByText("2000");
    expect(code2000.className).toContain("text-red-700");

    // >=3000 <4000 → text-blue-700
    const code3000 = view.getByText("3000");
    expect(code3000.className).toContain("text-blue-700");

    // >=4000 <5000 → text-emerald-700
    const code4000 = view.getByText("4000");
    expect(code4000.className).toContain("text-emerald-700");

    // >=5000 → text-orange-700
    const code5000 = view.getByText("5000");
    expect(code5000.className).toContain("text-orange-700");
  });

  it("calls apiFetch with correct URL", async () => {
    mockApiFetch.mockResolvedValue(sampleEntries);
    render(<TransactionDetailPage />);
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/finance/journal?includeDeleted=true");
    });
  });

  it("renders entry without description gracefully", async () => {
    const noDescEntry = [
      {
        transactionId: 1,
        effective: "2025-01-01",
        description: "",
        lines: [
          { accountNumber: 1000, accountName: "Cash", debit: 10, credit: null, description: null },
          { accountNumber: 2000, accountName: "AP", debit: null, credit: 10, description: null },
        ],
      },
    ];
    mockApiFetch.mockResolvedValue(noDescEntry);
    const { container } = render(<TransactionDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("Cash")).toBeInTheDocument();
    });
    // Empty description should not render the dash separator
    expect(view.queryByText(/—/)).not.toBeInTheDocument();
  });
});
