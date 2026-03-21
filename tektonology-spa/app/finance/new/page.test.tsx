import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within, cleanup } from "@testing-library/react";
import React from "react";

const mockApiFetch = vi.fn();

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

vi.mock("@/components/auth-guard", () => ({
  RequireRole: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/transaction-form", () => ({
  TransactionForm: ({ accounts }: { accounts: unknown[] }) => (
    <div data-testid="transaction-form">Form with {accounts.length} accounts</div>
  ),
}));

import NewTransactionPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("NewTransactionPage", () => {
  it("shows loading state while fetching accounts", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    render(<NewTransactionPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    mockApiFetch.mockRejectedValue(new Error("Unauthorized"));
    render(<NewTransactionPage />);
    await waitFor(() => {
      expect(screen.getByText("Unauthorized")).toBeInTheDocument();
    });
  });

  it("renders TransactionForm once accounts load", async () => {
    const accounts = [
      { number: 1000, name: "Cash", type: "asset" },
      { number: 2000, name: "Loan", type: "liability" },
    ];
    mockApiFetch.mockResolvedValue(accounts);
    render(<NewTransactionPage />);
    await waitFor(() => {
      expect(screen.getByTestId("transaction-form")).toBeInTheDocument();
    });
    expect(screen.getByText("Form with 2 accounts")).toBeInTheDocument();
  });

  it("renders breadcrumb and heading", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    const { container } = render(<NewTransactionPage />);
    const view = within(container);
    expect(view.getByText("Home")).toBeInTheDocument();
    expect(view.getByText("Finance")).toBeInTheDocument();
    expect(view.getByRole("heading", { name: "New Transaction" })).toBeInTheDocument();
    // Breadcrumb also contains "New Transaction" as a span
    expect(view.getAllByText("New Transaction")).toHaveLength(2);
    expect(view.getByText("Create a new journal entry. Debits must equal credits.")).toBeInTheDocument();
  });
});
