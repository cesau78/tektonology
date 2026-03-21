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

import ManufacturingDashboard from "./page";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

const dashboardData = {
  manufacturing: {
    totalPrintHours: 123.456,
    totalPrintCost: 45.67,
    totalJobs: 20,
    failedJobs: 3,
    scrapRate: "15.0",
  },
};

describe("ManufacturingDashboard", () => {
  it("shows loading state initially", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    const { container } = render(<ManufacturingDashboard />);
    expect(container.textContent).toContain("Loading...");
  });

  it("shows error state on fetch failure", async () => {
    mockApiFetch.mockRejectedValue(new Error("API down"));
    const { container } = render(<ManufacturingDashboard />);
    await waitFor(() => {
      expect(container.textContent).toContain("API down");
    });
  });

  it("renders dashboard with data", async () => {
    mockApiFetch.mockResolvedValue(dashboardData);
    const { container } = render(<ManufacturingDashboard />);
    await waitFor(() => {
      expect(container.textContent).toContain("123 hrs");
    });
    expect(container.textContent).toContain("$45.67 in materials");
    expect(container.textContent).toContain("15.0%");
    expect(container.textContent).toContain("3 of 20 jobs failed");
  });

  it("renders breadcrumb and heading", async () => {
    mockApiFetch.mockResolvedValue(dashboardData);
    const { container } = render(<ManufacturingDashboard />);
    await waitFor(() => {
      expect(container.querySelector("h1")?.textContent).toBe("Manufacturing");
    });
    expect(container.querySelector("a[href='/']")?.textContent).toBe("Home");
    expect(container.textContent).toContain("Production and print job tracking.");
  });

  it("renders nav items", async () => {
    mockApiFetch.mockResolvedValue(dashboardData);
    const { container } = render(<ManufacturingDashboard />);
    await waitFor(() => {
      expect(container.textContent).toContain("Print Jobs");
    });
    expect(container.textContent).toContain("Production log");
    const link = container.querySelector("a[href='/manufacturing/print-jobs']");
    expect(link).not.toBeNull();
  });

  it("renders Overview card", async () => {
    mockApiFetch.mockResolvedValue(dashboardData);
    const { container } = render(<ManufacturingDashboard />);
    await waitFor(() => {
      expect(container.textContent).toContain("Overview");
    });
  });
});
