import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within, cleanup } from "@testing-library/react";
import React from "react";

const mockApiFetch = vi.fn();
const mockUseRole = vi.fn();
const mockUseParams = vi.fn();

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
  useParams: () => mockUseParams(),
}));

import AccountDetailPage from "./page";

const sampleAccounts = [
  { number: 1000, name: "Cash", type: "asset", balance: 500 },
  { number: 2000, name: "Accounts Payable", type: "liability", balance: 200 },
  { number: 3000, name: "Retained Earnings", type: "equity", balance: 300 },
  { number: 4000, name: "Sales Revenue", type: "revenue", balance: 1200 },
  { number: 5000, name: "Cost of Goods Sold", type: "cogs", balance: 400 },
  { number: 6000, name: "Office Supplies", type: "expense", balance: 150 },
];

const sampleEntries = [
  {
    transactionId: 1,
    effective: "2026-01-15",
    description: "Initial deposit",
    lines: [
      { accountNumber: 1000, accountName: "Cash", debit: 500, credit: null },
      { accountNumber: 3000, accountName: "Retained Earnings", debit: null, credit: 500 },
    ],
  },
  {
    transactionId: 2,
    effective: "2026-02-01",
    description: "Office purchase",
    lines: [
      { accountNumber: 6000, accountName: "Office Supplies", debit: 50, credit: null },
      { accountNumber: 1000, accountName: "Cash", debit: null, credit: 50 },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseRole.mockReturnValue({ role: "owner", isLoaded: true });
  mockUseParams.mockReturnValue({ number: "1000" });
});

afterEach(() => {
  cleanup();
});

describe("AccountDetailPage", () => {
  // -- Loading / Error states --

  it("shows loading state while fetching", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    render(<AccountDetailPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    mockApiFetch.mockRejectedValue(new Error("Server error"));
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("shows 'Account not found' when account number doesn't match", async () => {
    mockUseParams.mockReturnValue({ number: "9999" });
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes("/accounts")) return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Account not found")).toBeInTheDocument();
    });
  });

  it("shows 'Invalid account number' for NaN params", async () => {
    mockUseParams.mockReturnValue({ number: "abc" });
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("Invalid account number")).toBeInTheDocument();
    });
    // Should not call apiFetch at all for invalid number
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  // -- Account header --

  it("renders account header with name, number, type badge, and balance", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes("/accounts")) return Promise.resolve(sampleAccounts);
      return Promise.resolve(sampleEntries);
    });
    const { container } = render(<AccountDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByRole("heading", { level: 1 })).toHaveTextContent("1000: Cash");
    });
    expect(view.getByText("Asset")).toBeInTheDocument();
    const balanceEl = container.querySelector(".font-mono.font-semibold.text-foreground");
    expect(balanceEl).toHaveTextContent("$500.00");
  });

  it("renders breadcrumb with account name", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes("/accounts")) return Promise.resolve(sampleAccounts);
      return Promise.resolve(sampleEntries);
    });
    const { container } = render(<AccountDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByRole("heading", { level: 1 })).toHaveTextContent("1000: Cash");
    });
    expect(view.getByText("Home")).toBeInTheDocument();
    expect(view.getByText("Finance")).toBeInTheDocument();
    expect(view.getByText("Chart of Accounts")).toBeInTheDocument();
    // Breadcrumb and heading both show account info
    const breadcrumbItems = view.getAllByText("1000: Cash");
    expect(breadcrumbItems.length).toBeGreaterThanOrEqual(1);
  });

  it("renders breadcrumb with raw account number while loading", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    const { container } = render(<AccountDetailPage />);
    const view = within(container);
    // Before account loads, breadcrumb shows just the number
    expect(view.getByText("1000")).toBeInTheDocument();
  });

  // -- Transactions table --

  it("renders transactions table with correct columns", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes("/accounts")) return Promise.resolve(sampleAccounts);
      return Promise.resolve(sampleEntries);
    });
    const { container } = render(<AccountDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByRole("heading", { level: 1 })).toHaveTextContent("1000: Cash");
    });
    expect(view.getByText("Txn #")).toBeInTheDocument();
    expect(view.getByText("Date")).toBeInTheDocument();
    expect(view.getByText("Description")).toBeInTheDocument();
    expect(view.getByText("Debit")).toBeInTheDocument();
    expect(view.getByText("Credit")).toBeInTheDocument();
  });

  it("shows 'No transactions' message when entries are empty", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes("/accounts")) return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("No transactions for this account.")).toBeInTheDocument();
    });
  });

  it("shows transaction count in header", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes("/accounts")) return Promise.resolve(sampleAccounts);
      return Promise.resolve(sampleEntries);
    });
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("(2)")).toBeInTheDocument();
    });
  });

  it("transaction rows link to /finance/journal/{transactionId}", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes("/accounts")) return Promise.resolve(sampleAccounts);
      return Promise.resolve(sampleEntries);
    });
    const { container } = render(<AccountDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("#1")).toBeInTheDocument();
    });
    const link1 = view.getByText("#1").closest("a");
    expect(link1).toHaveAttribute("href", "/finance/journal/1");
    const link2 = view.getByText("#2").closest("a");
    expect(link2).toHaveAttribute("href", "/finance/journal/2");
  });

  it("shows correct debit/credit for each transaction line matching the account", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes("/accounts")) return Promise.resolve(sampleAccounts);
      return Promise.resolve(sampleEntries);
    });
    const { container } = render(<AccountDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("#1")).toBeInTheDocument();
    });
    // Entry 1: Cash line has debit=500, credit=null
    const rows = view.getAllByRole("row");
    // rows[0] = header, rows[1] = txn 1, rows[2] = txn 2
    expect(rows[1]).toHaveTextContent("$500.00");
    expect(rows[1]).toHaveTextContent("Initial deposit");

    // Entry 2: Cash line has debit=null, credit=50
    expect(rows[2]).toHaveTextContent("$50.00");
    expect(rows[2]).toHaveTextContent("Office purchase");
  });

  it("skips entries where no line matches the account number", async () => {
    const entriesWithUnrelated = [
      ...sampleEntries,
      {
        transactionId: 3,
        effective: "2026-03-01",
        description: "Unrelated transaction",
        lines: [
          { accountNumber: 5000, accountName: "COGS", debit: 100, credit: null },
          { accountNumber: 6000, accountName: "Office Supplies", debit: null, credit: 100 },
        ],
      },
    ];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes("/accounts")) return Promise.resolve(sampleAccounts);
      return Promise.resolve(entriesWithUnrelated);
    });
    const { container } = render(<AccountDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("#1")).toBeInTheDocument();
    });
    // Should show entries count as 3 (total returned) but only render 2 rows
    expect(view.getByText("(3)")).toBeInTheDocument();
    expect(view.queryByText("Unrelated transaction")).not.toBeInTheDocument();
    // Only 2 data rows + 1 header
    const dataRows = view.getAllByRole("row");
    expect(dataRows).toHaveLength(3);
  });

  // -- Type badges for all account types --

  it("renders correct type badge for each account type", async () => {
    const types = [
      { number: 1000, type: "asset", label: "Asset" },
      { number: 2000, type: "liability", label: "Liability" },
      { number: 3000, type: "equity", label: "Equity" },
      { number: 4000, type: "revenue", label: "Revenue" },
      { number: 5000, type: "cogs", label: "COGS" },
      { number: 6000, type: "expense", label: "Expense" },
    ];

    for (const { number, type, label } of types) {
      cleanup();
      vi.clearAllMocks();
      mockUseRole.mockReturnValue({ role: "owner", isLoaded: true });
      mockUseParams.mockReturnValue({ number: String(number) });
      mockApiFetch.mockImplementation((url: string) => {
        if (url.includes("/accounts")) return Promise.resolve(sampleAccounts);
        return Promise.resolve([]);
      });
      render(<AccountDetailPage />);
      await waitFor(() => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    }
  });

  it("falls back to raw type string for unknown account type", async () => {
    const unknownAccounts = [
      { number: 1000, name: "Mystery", type: "other", balance: 0 },
    ];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes("/accounts")) return Promise.resolve(unknownAccounts);
      return Promise.resolve([]);
    });
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("other")).toBeInTheDocument();
    });
  });

  // -- Multiple entries with same account --

  it("shows all entries that match the account", async () => {
    const multipleEntries = [
      {
        transactionId: 10,
        effective: "2026-01-01",
        description: "Deposit A",
        lines: [
          { accountNumber: 1000, accountName: "Cash", debit: 100, credit: null },
        ],
      },
      {
        transactionId: 11,
        effective: "2026-01-02",
        description: "Deposit B",
        lines: [
          { accountNumber: 1000, accountName: "Cash", debit: 200, credit: null },
        ],
      },
      {
        transactionId: 12,
        effective: "2026-01-03",
        description: "Withdrawal",
        lines: [
          { accountNumber: 1000, accountName: "Cash", debit: null, credit: 50 },
        ],
      },
    ];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes("/accounts")) return Promise.resolve(sampleAccounts);
      return Promise.resolve(multipleEntries);
    });
    const { container } = render(<AccountDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("#10")).toBeInTheDocument();
    });
    expect(view.getByText("#11")).toBeInTheDocument();
    expect(view.getByText("#12")).toBeInTheDocument();
    expect(view.getByText("Deposit A")).toBeInTheDocument();
    expect(view.getByText("Deposit B")).toBeInTheDocument();
    expect(view.getByText("Withdrawal")).toBeInTheDocument();
    expect(view.getByText("(3)")).toBeInTheDocument();
  });

  // -- Breadcrumb links --

  it("breadcrumb links point to correct routes", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes("/accounts")) return Promise.resolve(sampleAccounts);
      return Promise.resolve(sampleEntries);
    });
    const { container } = render(<AccountDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByRole("heading", { level: 1 })).toHaveTextContent("1000: Cash");
    });
    const homeLink = view.getByText("Home").closest("a");
    expect(homeLink).toHaveAttribute("href", "/");
    const financeLink = view.getByText("Finance").closest("a");
    expect(financeLink).toHaveAttribute("href", "/finance");
    const accountsLink = view.getByText("Chart of Accounts").closest("a");
    expect(accountsLink).toHaveAttribute("href", "/finance/accounts");
  });

  // -- API call verification --

  it("calls apiFetch with correct URLs", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes("/accounts")) return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/finance/accounts");
      expect(mockApiFetch).toHaveBeenCalledWith("/api/finance/journal?accountNumber=1000");
    });
  });

  it("uses correct account number in journal API call", async () => {
    mockUseParams.mockReturnValue({ number: "2000" });
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes("/accounts")) return Promise.resolve(sampleAccounts);
      return Promise.resolve([]);
    });
    render(<AccountDetailPage />);
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/api/finance/journal?accountNumber=2000");
    });
  });

  // -- Debit null / Credit null display --

  it("renders empty cell when debit is null", async () => {
    const creditEntry = [
      {
        transactionId: 5,
        effective: "2026-03-01",
        description: "Credit only",
        lines: [
          { accountNumber: 1000, accountName: "Cash", debit: null, credit: 75 },
        ],
      },
    ];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes("/accounts")) return Promise.resolve(sampleAccounts);
      return Promise.resolve(creditEntry);
    });
    const { container } = render(<AccountDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("#5")).toBeInTheDocument();
    });
    const rows = view.getAllByRole("row");
    const cells = within(rows[1]).getAllByRole("cell");
    // Debit cell (index 3) should be empty, credit cell (index 4) should have value
    expect(cells[3].textContent).toBe("");
    expect(cells[4].textContent).toBe("$75.00");
  });

  it("renders empty cell when credit is null", async () => {
    const debitEntry = [
      {
        transactionId: 6,
        effective: "2026-03-02",
        description: "Debit only",
        lines: [
          { accountNumber: 1000, accountName: "Cash", debit: 200, credit: null },
        ],
      },
    ];
    mockApiFetch.mockImplementation((url: string) => {
      if (url.includes("/accounts")) return Promise.resolve(sampleAccounts);
      return Promise.resolve(debitEntry);
    });
    const { container } = render(<AccountDetailPage />);
    const view = within(container);
    await waitFor(() => {
      expect(view.getByText("#6")).toBeInTheDocument();
    });
    const rows = view.getAllByRole("row");
    const cells = within(rows[1]).getAllByRole("cell");
    // Debit cell (index 3) should have value, credit cell (index 4) should be empty
    expect(cells[3].textContent).toBe("$200.00");
    expect(cells[4].textContent).toBe("");
  });
});
