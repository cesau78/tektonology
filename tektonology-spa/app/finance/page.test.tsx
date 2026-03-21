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

import FinanceDashboard from "./page";

const dashboardData = {
  balanceSheet: {
    byType: {
      asset: [{ number: 1000, name: "Cash", balance: 500 }],
      liability: [{ number: 2000, name: "Loan", balance: 200 }],
      equity: [{ number: 3000, name: "Retained Earnings", balance: 300 }],
    },
    totalAssets: 500,
    totalLiabilities: 200,
    totalEquity: 300,
  },
  profitLoss: {
    revenue: 1000,
    expensesByCategory: { Filament: 200, Electricity: 100 },
    totalExpenses: 300,
    netIncome: 700,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("FinanceDashboard", () => {
  it("shows loading state while fetching", () => {
    mockUseRole.mockReturnValue({ role: "owner", isLoaded: true });
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    render(<FinanceDashboard />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    mockUseRole.mockReturnValue({ role: "owner", isLoaded: true });
    mockApiFetch.mockRejectedValue(new Error("Network fail"));
    render(<FinanceDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Network fail")).toBeInTheDocument();
    });
  });

  it("renders dashboard data for owner with all nav items", async () => {
    mockUseRole.mockReturnValue({ role: "owner", isLoaded: true });
    mockApiFetch.mockResolvedValue(dashboardData);
    const { container } = render(<FinanceDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Balance Sheet")).toBeInTheDocument();
    });
    const view = within(container);
    expect(view.getByText("Chart of Accounts")).toBeInTheDocument();
    expect(view.getByText("Journal")).toBeInTheDocument();
    expect(view.getByText("New Transaction")).toBeInTheDocument();
    expect(view.getByText("1000: Cash")).toBeInTheDocument();
    expect(view.getByText("2000: Loan")).toBeInTheDocument();
    expect(view.getByText("3000: Retained Earnings")).toBeInTheDocument();
    expect(view.getByText("Profit & Loss")).toBeInTheDocument();
    expect(view.getByText("Net Income")).toBeInTheDocument();
    expect(view.getByText("Filament")).toBeInTheDocument();
    expect(view.getByText("Electricity")).toBeInTheDocument();
  });

  it("hides New Transaction nav item for auditor", async () => {
    mockUseRole.mockReturnValue({ role: "auditor", isLoaded: true });
    mockApiFetch.mockResolvedValue(dashboardData);
    const { container } = render(<FinanceDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Balance Sheet")).toBeInTheDocument();
    });
    const view = within(container);
    expect(view.getByText("Chart of Accounts")).toBeInTheDocument();
    expect(view.getByText("Journal")).toBeInTheDocument();
    expect(view.queryByText("New Transaction")).not.toBeInTheDocument();
  });

  it("renders negative net income with red styling", async () => {
    mockUseRole.mockReturnValue({ role: "owner", isLoaded: true });
    const negativeData = {
      ...dashboardData,
      profitLoss: { ...dashboardData.profitLoss, netIncome: -100 },
    };
    mockApiFetch.mockResolvedValue(negativeData);
    render(<FinanceDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Net Income")).toBeInTheDocument();
    });
    // Negative net income renders with red text
    const netIncomeValue = screen.getByText("-$100.00");
    expect(netIncomeValue.className).toContain("text-red-700");
  });

  it("renders zero net income with green styling", async () => {
    mockUseRole.mockReturnValue({ role: "owner", isLoaded: true });
    const zeroData = {
      ...dashboardData,
      profitLoss: { ...dashboardData.profitLoss, netIncome: 0 },
    };
    mockApiFetch.mockResolvedValue(zeroData);
    render(<FinanceDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Net Income")).toBeInTheDocument();
    });
    const netIncomeValue = screen.getByText("$0.00");
    expect(netIncomeValue.className).toContain("text-emerald-700");
  });

  it("renders balance sheet type with no accounts gracefully", async () => {
    mockUseRole.mockReturnValue({ role: "owner", isLoaded: true });
    const emptyByType = {
      ...dashboardData,
      balanceSheet: { ...dashboardData.balanceSheet, byType: {} },
    };
    mockApiFetch.mockResolvedValue(emptyByType);
    render(<FinanceDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Balance Sheet")).toBeInTheDocument();
    });
    // Should still render the type sections with badges
    expect(screen.getByText("Assets")).toBeInTheDocument();
    expect(screen.getByText("Liabilities")).toBeInTheDocument();
    expect(screen.getByText("Equity")).toBeInTheDocument();
  });

  it("renders breadcrumb navigation", async () => {
    mockUseRole.mockReturnValue({ role: "owner", isLoaded: true });
    mockApiFetch.mockResolvedValue(dashboardData);
    render(<FinanceDashboard />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Finance" })).toBeInTheDocument();
  });
});
