import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";

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

import ProcurementDashboard from "./page";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

const dashboardData = {
  procurement: {
    totalFilamentG: 2500,
    totalFilamentCost: 89.99,
    activeSpools: 3,
    depletedSpools: 1,
    totalSpools: 4,
  },
};

describe("ProcurementDashboard", () => {
  it("shows loading state initially", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    const { container } = render(<ProcurementDashboard />);
    expect(container.textContent).toContain("Loading...");
  });

  it("shows error state on fetch failure", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network error"));
    const { container } = render(<ProcurementDashboard />);
    await waitFor(() => {
      expect(container.textContent).toContain("Network error");
    });
  });

  it("renders dashboard with data", async () => {
    mockApiFetch.mockResolvedValue(dashboardData);
    const { container } = render(<ProcurementDashboard />);
    await waitFor(() => {
      expect(container.textContent).toContain("2.5 kg");
    });
    expect(container.textContent).toContain("$89.99 invested");
    expect(container.textContent).toContain("3 active");
    expect(container.textContent).toContain("1 depleted");
  });

  it("renders breadcrumb and heading", async () => {
    mockApiFetch.mockResolvedValue(dashboardData);
    const { container } = render(<ProcurementDashboard />);
    await waitFor(() => {
      expect(container.querySelector("h1")?.textContent).toBe("Procurement");
    });
    expect(container.querySelector("a[href='/']")?.textContent).toBe("Home");
    expect(container.textContent).toContain("Raw materials and sourcing.");
  });

  it("renders nav items with correct links", async () => {
    mockApiFetch.mockResolvedValue(dashboardData);
    const { container } = render(<ProcurementDashboard />);
    await waitFor(() => {
      expect(container.textContent).toContain("Filament Spools");
    });
    expect(container.textContent).toContain("Hardware Inventory");
    expect(container.textContent).toContain("Inventory tracking");
    expect(container.textContent).toContain("Bolts, nuts, wrenches");

    const spoolsLink = container.querySelector("a[href='/procurement/spools']");
    expect(spoolsLink).not.toBeNull();

    const hardwareLink = container.querySelector("a[href='/procurement/hardware']");
    expect(hardwareLink).not.toBeNull();
  });

  it("renders Overview card", async () => {
    mockApiFetch.mockResolvedValue(dashboardData);
    const { container } = render(<ProcurementDashboard />);
    await waitFor(() => {
      expect(container.textContent).toContain("Overview");
    });
    expect(container.textContent).toContain("Filament on Hand");
    expect(container.textContent).toContain("Spools");
  });
});
