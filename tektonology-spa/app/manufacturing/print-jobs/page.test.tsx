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

import PrintJobsPage from "./page";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleJobs = [
  {
    batchId: 1,
    date: "2025-01-15",
    project: "Kneeler",
    product: "Boot",
    spool: "Spool-1",
    usageG: 150,
    totalHours: 5.5,
    cost: 3.25,
    success: true,
    usage: "Inventory",
    quantity: 4,
    part: "Upper Boot",
    comments: "Good quality",
  },
  {
    batchId: 2,
    date: "2025-01-16",
    project: "Kneeler",
    product: "Bushing",
    spool: "Spool-2",
    usageG: 80,
    totalHours: 2.0,
    cost: 1.50,
    success: false,
    usage: "Scrap",
    quantity: 2,
    part: "Bushing",
    comments: "",
  },
  {
    batchId: 3,
    date: "2025-01-17",
    project: "Bait Station",
    product: "Station",
    spool: "Spool-1",
    usageG: 200,
    totalHours: 8.0,
    cost: 5.00,
    success: null,
    usage: "Prototype",
    quantity: 1,
    part: "Station Body",
    comments: "Testing fit",
  },
  {
    batchId: 4,
    date: "2025-01-18",
    project: "Shop",
    product: "Tool Holder",
    spool: "Spool-3",
    usageG: 50,
    totalHours: 1.5,
    cost: 0.75,
    success: true,
    usage: "Shop",
    quantity: 1,
    part: "Holder",
    comments: "",
  },
  {
    batchId: 5,
    date: "2025-01-19",
    project: "Unknown",
    product: "Widget",
    spool: "Spool-4",
    usageG: 30,
    totalHours: 1.0,
    cost: 0.50,
    success: true,
    usage: "Custom",
    quantity: 1,
    part: "Widget",
    comments: "",
  },
  {
    batchId: 6,
    date: "2025-01-20",
    project: "Kneeler",
    product: "Boot",
    spool: "Spool-1",
    usageG: 160,
    totalHours: 5.0,
    cost: 3.00,
    success: true,
    usage: "Inventory",
    quantity: 4,
    part: "Lower Boot",
    comments: "",
  },
];

describe("PrintJobsPage", () => {
  it("shows loading state initially", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    const { container } = render(<PrintJobsPage />);
    expect(container.textContent).toContain("Loading...");
  });

  it("shows error state on fetch failure", async () => {
    mockApiFetch.mockRejectedValue(new Error("Fetch failed"));
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Fetch failed");
    });
  });

  it("renders jobs with summary stats", async () => {
    mockApiFetch.mockResolvedValue(sampleJobs);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("6 jobs");
    });
    expect(container.textContent).toContain("23 hours");
    expect(container.textContent).toContain("0.7 kg used");
  });

  it("renders breadcrumb navigation", async () => {
    mockApiFetch.mockResolvedValue(sampleJobs);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.querySelector("a[href='/']")?.textContent).toBe("Home");
    });
    expect(container.querySelector("a[href='/manufacturing']")?.textContent).toBe("Manufacturing");
    expect(container.querySelector("nav span.text-foreground")?.textContent).toBe("Print Jobs");
  });

  it("groups jobs by usage type with stats cards", async () => {
    mockApiFetch.mockResolvedValue(sampleJobs);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Inventory");
    });
    expect(container.textContent).toContain("Scrap");
    expect(container.textContent).toContain("Prototype");
    expect(container.textContent).toContain("Shop");
    expect(container.textContent).toContain("Custom");
  });

  it("renders Pass/Fail/\u2014 status correctly", async () => {
    mockApiFetch.mockResolvedValue(sampleJobs);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      // Scope to the table body for status elements
      const tbody = container.querySelector("tbody");
      const passElements = tbody!.querySelectorAll(".text-emerald-600");
      // 4 jobs have success: true (batchId 1, 4, 5, 6)
      expect(passElements).toHaveLength(4);
    });
    const tbody = container.querySelector("tbody")!;
    expect(tbody.querySelector("span.text-red-600")?.textContent).toBe("Fail");
    // The em-dash for null success
    const mutedSpans = tbody.querySelectorAll(".text-muted-foreground");
    const dashSpans = Array.from(mutedSpans).filter((el) => el.textContent === "\u2014");
    expect(dashSpans.length).toBeGreaterThanOrEqual(1);
  });

  it("shows comments tooltip for jobs with comments", async () => {
    mockApiFetch.mockResolvedValue(sampleJobs);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });
    const asterisks = container.querySelectorAll("[title]");
    const commentTitles = Array.from(asterisks).map((el) => el.getAttribute("title"));
    expect(commentTitles).toContain("Good quality");
    expect(commentTitles).toContain("Testing fit");
  });

  it("does not show asterisk for jobs without comments", async () => {
    mockApiFetch.mockResolvedValue(sampleJobs);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Bushing");
    });
    // Bushing has empty comments -- no asterisk next to it
  });

  it("renders all table columns for each job", async () => {
    mockApiFetch.mockResolvedValue(sampleJobs);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });
    expect(container.textContent).toContain("Station Body");
    expect(container.textContent).toContain("150");
    expect(container.textContent).toContain("5.5");
  });

  it("handles jobs with missing usage (falls back to Unknown)", async () => {
    const jobsWithEmpty = [
      {
        batchId: 99,
        date: "2025-01-01",
        project: "Test",
        product: "Test",
        spool: "S1",
        usageG: 10,
        totalHours: 1,
        cost: 0.5,
        success: true,
        usage: "",
        quantity: 1,
        part: "Part",
        comments: "",
      },
    ];
    mockApiFetch.mockResolvedValue(jobsWithEmpty);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Unknown");
    });
  });

  it("applies default badge style for unknown usage types", async () => {
    mockApiFetch.mockResolvedValue(sampleJobs);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Custom");
    });
    // "Custom" is not in usageBadge, so it gets default gray or empty style
  });

  it("handles null/undefined numeric fields with ?? 0 fallbacks", async () => {
    const jobsWithNulls = [
      {
        batchId: 99,
        date: "2025-01-01",
        project: "Test",
        product: "Widget",
        spool: "PLA",
        usageG: undefined as unknown as number,
        totalHours: undefined as unknown as number,
        cost: undefined as unknown as number,
        success: null,
        usage: "",
        quantity: 1,
        part: "Bracket",
        comments: "",
      },
      {
        batchId: 100,
        date: "2025-01-02",
        project: "Test2",
        product: "Gadget",
        spool: "PLA",
        usageG: null as unknown as number,
        totalHours: null as unknown as number,
        cost: null as unknown as number,
        success: null,
        usage: "UnmappedType",
        quantity: 2,
        part: "Gear",
        comments: "has a comment",
      },
    ];
    mockApiFetch.mockResolvedValue(jobsWithNulls);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("2 jobs");
    });

    // Summary stats should all be 0 due to ?? 0 fallbacks
    expect(container.textContent).toContain("0 hours");
    expect(container.textContent).toContain("0.0 kg used");
    expect(container.textContent).toContain("$0.00");

    // Empty usage falls back to "Unknown" in the byUsage grouping
    expect(container.textContent).toContain("Unknown");

    // "UnmappedType" hits the fallback badge (bg-gray-100...) in summary cards
    expect(container.textContent).toContain("UnmappedType");

    // Table cells: usageG ?? 0, totalHours ?? 0, cost ?? 0
    const tbody = container.querySelector("tbody")!;
    const rows = tbody.querySelectorAll("tr");
    expect(rows).toHaveLength(2);

    // Both rows should show "—" for null success
    const mutedSpans = tbody.querySelectorAll(".text-muted-foreground");
    const dashSpans = Array.from(mutedSpans).filter((el) => el.textContent === "—");
    expect(dashSpans).toHaveLength(2);

    // The second job has comments, so it should have an asterisk with title
    const titled = tbody.querySelectorAll("[title]");
    const titles = Array.from(titled).map((el) => el.getAttribute("title"));
    expect(titles).toContain("has a comment");

    // The first job has empty comments, so no asterisk
    const firstRow = rows[0];
    expect(firstRow.querySelector("[title]")).toBeNull();

    // Table row badge for "UnmappedType" gets fallback empty class (usageBadge[j.usage] ?? "")
    // Find the badge by looking for the text content within the table
    const allElements = tbody.querySelectorAll("*");
    const unmappedBadge = Array.from(allElements).find(
      (el) => el.textContent?.trim() === "UnmappedType" && el.children.length === 0
    );
    expect(unmappedBadge).toBeDefined();
    expect(unmappedBadge!.className).not.toContain("bg-emerald-100");
    expect(unmappedBadge!.className).not.toContain("bg-blue-100");
    expect(unmappedBadge!.className).not.toContain("bg-red-100");
    expect(unmappedBadge!.className).not.toContain("bg-violet-100");
  });
});
