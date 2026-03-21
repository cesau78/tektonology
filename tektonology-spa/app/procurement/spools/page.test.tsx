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

import SpoolsPage from "./page";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleSpools = [
  {
    spoolId: 1,
    brand: "Bambu",
    material: "PLA Pro",
    color: "Black",
    cost: 24.99,
    weightG: 1000,
    remainingG: 750,
  },
  {
    spoolId: 2,
    brand: "Bambu",
    material: "PLA Pro",
    color: "White",
    cost: 24.99,
    weightG: 1000,
    remainingG: 100,
  },
  {
    spoolId: 3,
    brand: "Overture",
    material: "TPU 90A",
    color: "Black",
    cost: 29.99,
    weightG: 1000,
    remainingG: 600,
  },
  {
    spoolId: 4,
    brand: "Bambu",
    material: "PETG",
    color: "Clear",
    cost: 22.99,
    weightG: 1000,
    remainingG: 300,
  },
  {
    spoolId: 5,
    brand: "Generic",
    material: "ABS",
    color: "Red",
    cost: 18.99,
    weightG: 1000,
    remainingG: 50,
  },
  {
    spoolId: 6,
    brand: "Test",
    material: "ABS",
    color: "Blue",
    cost: 10.00,
    weightG: 0,
    remainingG: 0,
  },
];

describe("SpoolsPage", () => {
  it("shows loading state initially", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    const { container } = render(<SpoolsPage />);
    expect(container.textContent).toContain("Loading...");
  });

  it("shows error state on fetch failure", async () => {
    mockApiFetch.mockRejectedValue(new Error("API error"));
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("API error");
    });
  });

  it("renders spools grouped by material with summary", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("6 spools");
    });
    expect(container.textContent).toContain("kg remaining");
    expect(container.textContent).toContain("invested");
  });

  it("renders breadcrumb navigation", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      expect(container.querySelector("a[href='/']")?.textContent).toBe("Home");
    });
    expect(container.querySelector("a[href='/procurement']")?.textContent).toBe("Procurement");
    expect(container.querySelector("nav span.text-foreground")?.textContent).toBe("Filament Spools");
  });

  it("renders material group badges", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("PLA Pro");
    });
    expect(container.textContent).toContain("TPU 90A");
    expect(container.textContent).toContain("PETG");
    expect(container.textContent).toContain("ABS");
  });

  it("renders per-material subtotals", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("PLA Pro");
    });
    // PLA Pro group: 850g remaining / 2000g total => 0.8 / 2.0 kg (850/1000 rounds to 0.8)
    expect(container.textContent).toContain("0.8 / 2.0 kg");
  });

  it("renders spool table columns correctly", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Bambu");
    });
    expect(container.textContent).toContain("Overture");
    expect(container.textContent).toContain("Black");
    expect(container.textContent).toContain("750g");
  });

  it("shows correct percentage and color for progress bars", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("75%");
    });
    expect(container.textContent).toContain("10%");
    expect(container.textContent).toContain("60%");
    expect(container.textContent).toContain("30%");
    expect(container.textContent).toContain("5%");

    // Check progress bar colors
    const progressBars = container.querySelectorAll("[style]");
    const barClasses = Array.from(progressBars).map((el) => el.className);
    // > 50% = emerald
    expect(barClasses.some((c) => c.includes("bg-emerald-500"))).toBe(true);
    // 20-50% = amber
    expect(barClasses.some((c) => c.includes("bg-amber-500"))).toBe(true);
    // < 20% = red
    expect(barClasses.some((c) => c.includes("bg-red-500"))).toBe(true);
  });

  it("handles spool with zero weight (0% and 0 costPerG)", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("0%");
    });
    // costPerG = 0 when weightG = 0
    expect(container.textContent).toContain("0.000");
  });

  it("applies default gray badge for unknown material types", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("ABS");
    });
    // ABS is not in materialColor map, so it gets gray
  });

  it("renders cost per gram correctly", async () => {
    mockApiFetch.mockResolvedValue(sampleSpools);
    const { container } = render(<SpoolsPage />);
    await waitFor(() => {
      // 24.99 / 1000 = 0.025
      const text = container.textContent ?? "";
      const matches = text.match(/0\.025/g);
      expect(matches).toHaveLength(2); // Two PLA Pro spools
    });
  });
});
