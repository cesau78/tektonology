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

import HardwarePage from "./page";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleHardware = [
  {
    hardwareId: 1,
    supplier: "McMaster-Carr",
    item: "Hex Bolt",
    dimensions: "M5x20",
    cost: 12.50,
    quantity: 100,
    remaining: 85,
  },
  {
    hardwareId: 2,
    supplier: "Fastenal",
    item: "Lock Nut",
    dimensions: "M5",
    cost: 8.00,
    quantity: 200,
    remaining: 150,
  },
  {
    hardwareId: 3,
    supplier: "Amazon",
    item: "Allen Wrench",
    dimensions: "4mm",
    cost: 5.99,
    quantity: 0,
    remaining: 0,
  },
];

describe("HardwarePage", () => {
  it("shows loading state initially", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    const { container } = render(<HardwarePage />);
    expect(container.textContent).toContain("Loading...");
  });

  it("shows error state on fetch failure", async () => {
    mockApiFetch.mockRejectedValue(new Error("Server error"));
    const { container } = render(<HardwarePage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Server error");
    });
  });

  it("renders hardware table with data", async () => {
    mockApiFetch.mockResolvedValue(sampleHardware);
    const { container } = render(<HardwarePage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Hex Bolt");
    });
    expect(container.textContent).toContain("Lock Nut");
    expect(container.textContent).toContain("Allen Wrench");
  });

  it("renders breadcrumb navigation", async () => {
    mockApiFetch.mockResolvedValue(sampleHardware);
    const { container } = render(<HardwarePage />);
    await waitFor(() => {
      expect(container.querySelector("a[href='/']")?.textContent).toBe("Home");
    });
    expect(container.querySelector("a[href='/procurement']")?.textContent).toBe("Procurement");
    expect(container.querySelector("nav span.text-foreground")?.textContent).toBe("Hardware Inventory");
  });

  it("shows summary with total pieces and cost", async () => {
    mockApiFetch.mockResolvedValue(sampleHardware);
    const { container } = render(<HardwarePage />);
    await waitFor(() => {
      expect(container.textContent).toContain("235 pieces on hand");
    });
    expect(container.textContent).toContain("$26.49 invested");
  });

  it("renders all table columns", async () => {
    mockApiFetch.mockResolvedValue(sampleHardware);
    const { container } = render(<HardwarePage />);
    await waitFor(() => {
      expect(container.textContent).toContain("McMaster-Carr");
    });
    expect(container.textContent).toContain("Fastenal");
    expect(container.textContent).toContain("M5x20");
    expect(container.textContent).toContain("M5");
    expect(container.textContent).toContain("4mm");
  });

  it("calculates unit cost correctly", async () => {
    mockApiFetch.mockResolvedValue(sampleHardware);
    const { container } = render(<HardwarePage />);
    await waitFor(() => {
      // Unit cost for Hex Bolt: 12.50 / 100 = $0.13
      expect(container.textContent).toContain("$0.13");
    });
    // Unit cost for Lock Nut: 8.00 / 200 = $0.04
    expect(container.textContent).toContain("$0.04");
  });

  it("handles zero quantity (unit cost = 0)", async () => {
    mockApiFetch.mockResolvedValue(sampleHardware);
    const { container } = render(<HardwarePage />);
    await waitFor(() => {
      // Allen Wrench: quantity 0, unitCost = 0 => "$0.00"
      expect(container.textContent).toContain("$0.00");
    });
  });

  it("renders quantity and remaining columns", async () => {
    mockApiFetch.mockResolvedValue(sampleHardware);
    const { container } = render(<HardwarePage />);
    await waitFor(() => {
      expect(container.textContent).toContain("100");
    });
    expect(container.textContent).toContain("85");
    expect(container.textContent).toContain("200");
    expect(container.textContent).toContain("150");
  });
});
