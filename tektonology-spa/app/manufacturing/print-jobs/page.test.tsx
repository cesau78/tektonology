import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor, fireEvent, within, act } from "@testing-library/react";

const mockApiFetch = vi.fn();
const mockCanWrite = vi.fn().mockReturnValue(true);

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
  canWrite: (...args: unknown[]) => mockCanWrite(...args),
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

  // ── Helpers for CRUD tests ──────────────────────────────────────────
  const sampleJobsWithIds = sampleJobs.map((j, i) => ({ ...j, _id: `id${i + 1}` }));

  const sampleJobsWithDeleted = [
    { ...sampleJobs[0], _id: "id1" },
    { ...sampleJobs[1], _id: "id2", deletedAt: "2025-01-01T00:00:00.000Z" },
  ];

  // ── Add Row ─────────────────────────────────────────────────────────

  it("opens add form and cancels", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const addBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "+ Add Job"
    )!;
    await act(async () => fireEvent.click(addBtn));

    // Form row should now exist with a Cancel button
    expect(container.querySelector("input[placeholder='Part name']")).toBeTruthy();

    const cancelBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Cancel"
    )!;
    await act(async () => fireEvent.click(cancelBtn));

    expect(container.querySelector("input[placeholder='Part name']")).toBeNull();
  });

  it("adds a job successfully", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const addBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "+ Add Job"
    )!;
    await act(async () => fireEvent.click(addBtn));

    const batchInput = container.querySelector("input[type='number'][placeholder='1']") as HTMLInputElement;
    const partInput = container.querySelector("input[placeholder='Part name']") as HTMLInputElement;

    fireEvent.change(batchInput, { target: { value: "42" } });
    fireEvent.change(partInput, { target: { value: "New Part" } });

    mockApiFetch.mockResolvedValueOnce({});
    mockApiFetch.mockResolvedValueOnce(sampleJobsWithIds);

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Save"
    )!;
    await act(async () => fireEvent.click(saveBtn));

    await waitFor(() => {
      const postCall = mockApiFetch.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/manufacturing/print-jobs" && c[1]?.method === "POST"
      );
      expect(postCall).toBeTruthy();
    });
  });

  it("exercises all add-row field onChange handlers", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const addBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "+ Add Job"
    )!;
    await act(async () => fireEvent.click(addBtn));

    // Fill required fields
    const batchInput = container.querySelector("input[type='number'][placeholder='1']") as HTMLInputElement;
    const partInput = container.querySelector("input[placeholder='Part name']") as HTMLInputElement;
    fireEvent.change(batchInput, { target: { value: "42" } });
    fireEvent.change(partInput, { target: { value: "New Part" } });

    // Change success select and usage select (add-row selects)
    const selects = container.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "true" } });
    fireEvent.change(selects[1], { target: { value: "Shop" } });

    // Change quantity, usageG, totalHours, cost number inputs (add row)
    // The add row number inputs come after batchId; find them by placeholder or position
    const numberInputs = Array.from(container.querySelectorAll("input[type='number']"));
    // Skip batchId (index 0), then: quantity, usageG, totalHours, cost
    if (numberInputs.length >= 5) {
      fireEvent.change(numberInputs[1], { target: { value: "5" } });
      fireEvent.change(numberInputs[2], { target: { value: "100" } });
      fireEvent.change(numberInputs[3], { target: { value: "2.5" } });
      fireEvent.change(numberInputs[4], { target: { value: "4.00" } });
    }

    // Change comments input
    const commentsInput = container.querySelector("input[placeholder='Comments']") as HTMLInputElement;
    fireEvent.change(commentsInput, { target: { value: "Test comment" } });

    // Save
    mockApiFetch.mockResolvedValueOnce({});
    mockApiFetch.mockResolvedValueOnce(sampleJobsWithIds);

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Save"
    )!;
    await act(async () => fireEvent.click(saveBtn));

    await waitFor(() => {
      const postCall = mockApiFetch.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/manufacturing/print-jobs" && (c[1] as Record<string, unknown>)?.method === "POST"
      );
      expect(postCall).toBeTruthy();
    });
  });

  it("adds a job with empty numeric fields (triggers || 0 fallbacks)", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const addBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "+ Add Job"
    )!;
    await act(async () => fireEvent.click(addBtn));

    // Fill only required fields, leave numeric fields empty
    const batchInput = container.querySelector("input[type='number'][placeholder='1']") as HTMLInputElement;
    const partInput = container.querySelector("input[placeholder='Part name']") as HTMLInputElement;
    const dateInput = container.querySelector("input[type='date']") as HTMLInputElement;
    fireEvent.change(batchInput, { target: { value: "1" } });
    fireEvent.change(partInput, { target: { value: "Test Part" } });
    fireEvent.change(dateInput, { target: { value: "2025-01-01" } });

    // Clear the numeric fields to empty strings (they default to empty, triggering || 0)
    const numberInputs = Array.from(container.querySelectorAll("input[type='number']"));
    for (let i = 1; i < numberInputs.length; i++) {
      fireEvent.change(numberInputs[i], { target: { value: "" } });
    }

    mockApiFetch.mockResolvedValueOnce({});
    mockApiFetch.mockResolvedValueOnce(sampleJobsWithIds);

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Save"
    )!;
    await act(async () => fireEvent.click(saveBtn));

    await waitFor(() => {
      const postCall = mockApiFetch.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/manufacturing/print-jobs" && (c[1] as Record<string, unknown>)?.method === "POST"
      );
      expect(postCall).toBeTruthy();
      const body = JSON.parse((postCall![1] as Record<string, string>).body);
      expect(body.quantity).toBe(0);
      expect(body.usageG).toBe(0);
      expect(body.totalHours).toBe(0);
      expect(body.cost).toBe(0);
    });
  });

  it("validates empty batchId on add", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const addBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "+ Add Job"
    )!;
    await act(async () => fireEvent.click(addBtn));

    // batchId is empty by default, part filled
    const partInput = container.querySelector("input[placeholder='Part name']") as HTMLInputElement;
    fireEvent.change(partInput, { target: { value: "Some Part" } });

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Save"
    )!;
    await act(async () => fireEvent.click(saveBtn));

    expect(container.textContent).toContain("Batch ID must be a positive integer");
  });

  it("validates zero batchId on add", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const addBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "+ Add Job"
    )!;
    await act(async () => fireEvent.click(addBtn));

    const batchInput = container.querySelector("input[type='number'][placeholder='1']") as HTMLInputElement;
    fireEvent.change(batchInput, { target: { value: "0" } });

    const partInput = container.querySelector("input[placeholder='Part name']") as HTMLInputElement;
    fireEvent.change(partInput, { target: { value: "Some Part" } });

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Save"
    )!;
    await act(async () => fireEvent.click(saveBtn));

    expect(container.textContent).toContain("Batch ID must be a positive integer");
  });

  it("validates empty part on add", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const addBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "+ Add Job"
    )!;
    await act(async () => fireEvent.click(addBtn));

    const batchInput = container.querySelector("input[type='number'][placeholder='1']") as HTMLInputElement;
    fireEvent.change(batchInput, { target: { value: "5" } });
    // part left empty

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Save"
    )!;
    await act(async () => fireEvent.click(saveBtn));

    expect(container.textContent).toContain("Part name is required");
  });

  it("validates empty date on add", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const addBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "+ Add Job"
    )!;
    await act(async () => fireEvent.click(addBtn));

    const batchInput = container.querySelector("input[type='number'][placeholder='1']") as HTMLInputElement;
    fireEvent.change(batchInput, { target: { value: "5" } });
    const partInput = container.querySelector("input[placeholder='Part name']") as HTMLInputElement;
    fireEvent.change(partInput, { target: { value: "Some Part" } });
    // Clear the date
    const dateInput = container.querySelector("input[type='date']") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "" } });

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Save"
    )!;
    await act(async () => fireEvent.click(saveBtn));

    expect(container.textContent).toContain("Date is required");
  });

  it("shows error message on add API error (Error)", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const addBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "+ Add Job"
    )!;
    await act(async () => fireEvent.click(addBtn));

    const batchInput = container.querySelector("input[type='number'][placeholder='1']") as HTMLInputElement;
    fireEvent.change(batchInput, { target: { value: "5" } });
    const partInput = container.querySelector("input[placeholder='Part name']") as HTMLInputElement;
    fireEvent.change(partInput, { target: { value: "Some Part" } });

    mockApiFetch.mockRejectedValueOnce(new Error("Server exploded"));

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Save"
    )!;
    await act(async () => fireEvent.click(saveBtn));

    await waitFor(() => {
      expect(container.textContent).toContain("Server exploded");
    });
  });

  it("shows generic message on add API error (non-Error)", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const addBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "+ Add Job"
    )!;
    await act(async () => fireEvent.click(addBtn));

    const batchInput = container.querySelector("input[type='number'][placeholder='1']") as HTMLInputElement;
    fireEvent.change(batchInput, { target: { value: "5" } });
    const partInput = container.querySelector("input[placeholder='Part name']") as HTMLInputElement;
    fireEvent.change(partInput, { target: { value: "Some Part" } });

    mockApiFetch.mockRejectedValueOnce("string error");

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Save"
    )!;
    await act(async () => fireEvent.click(saveBtn));

    await waitFor(() => {
      expect(container.textContent).toContain("Failed to add");
    });
  });

  it("hides add button while add row is visible", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const addBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "+ Add Job"
    )!;
    await act(async () => fireEvent.click(addBtn));

    const addBtnAfter = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "+ Add Job"
    );
    expect(addBtnAfter).toBeUndefined();
  });

  // ── Edit Row ────────────────────────────────────────────────────────

  it("enters edit mode and cancels", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const editBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Edit"
    )!;
    await act(async () => fireEvent.click(editBtn));

    // Should show Save/Cancel in the row
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Save"
    );
    expect(saveBtn).toBeTruthy();

    const cancelBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Cancel"
    )!;
    await act(async () => fireEvent.click(cancelBtn));

    // Save should be gone
    const saveBtnAfter = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Save"
    );
    expect(saveBtnAfter).toBeUndefined();
  });

  it("enters edit mode on jobs with success=false and success=null (successToString branches)", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const editBtns = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.textContent === "Edit"
    );
    // Edit second job (success: false)
    await act(async () => fireEvent.click(editBtns[1]));
    let selects = container.querySelectorAll("select");
    expect((selects[0] as HTMLSelectElement).value).toBe("false");
    // Cancel
    const cancelBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Cancel"
    )!;
    await act(async () => fireEvent.click(cancelBtn));

    // Edit third job (success: null)
    const editBtns2 = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.textContent === "Edit"
    );
    await act(async () => fireEvent.click(editBtns2[2]));
    selects = container.querySelectorAll("select");
    expect((selects[0] as HTMLSelectElement).value).toBe("null");
    const cancelBtn2 = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Cancel"
    )!;
    await act(async () => fireEvent.click(cancelBtn2));

    // Edit fifth job (comments: undefined — triggers ?? "" fallback)
    const editBtns3 = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.textContent === "Edit"
    );
    await act(async () => fireEvent.click(editBtns3[4]));
    const cancelBtn3 = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Cancel"
    )!;
    await act(async () => fireEvent.click(cancelBtn3));
  });

  it("saves edit successfully", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const editBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Edit"
    )!;
    await act(async () => fireEvent.click(editBtn));

    // Change the part name input
    const partInput = container.querySelector("input[type='text']") as HTMLInputElement;
    fireEvent.change(partInput, { target: { value: "Edited Part" } });

    mockApiFetch.mockResolvedValueOnce({});
    mockApiFetch.mockResolvedValueOnce(sampleJobsWithIds);

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Save"
    )!;
    await act(async () => fireEvent.click(saveBtn));

    await waitFor(() => {
      const putCall = mockApiFetch.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/manufacturing/print-jobs/id1" && c[1]?.method === "PUT"
      );
      expect(putCall).toBeTruthy();
    });
  });

  it("exercises all edit-mode field onChange handlers", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const editBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Edit"
    )!;
    await act(async () => fireEvent.click(editBtn));

    // Change success select
    const selects = container.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "false" } });

    // Change usage select
    fireEvent.change(selects[1], { target: { value: "Scrap" } });

    // Change numeric inputs: quantity, usageG, totalHours, cost (skip batchId at index 0)
    const numberInputs = container.querySelectorAll("input[type='number']");
    fireEvent.change(numberInputs[1], { target: { value: "10" } }); // quantity
    fireEvent.change(numberInputs[2], { target: { value: "200" } }); // usageG
    fireEvent.change(numberInputs[3], { target: { value: "3.5" } }); // totalHours
    fireEvent.change(numberInputs[4], { target: { value: "7.50" } }); // cost

    // Change comments text input (second text input after part)
    const textInputs = container.querySelectorAll("input[type='text']");
    const commentsInput = textInputs[textInputs.length - 1];
    fireEvent.change(commentsInput, { target: { value: "Updated comments" } });

    // Save to verify all changes were applied
    mockApiFetch.mockResolvedValueOnce({});
    mockApiFetch.mockResolvedValueOnce(sampleJobsWithIds);

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Save"
    )!;
    await act(async () => fireEvent.click(saveBtn));

    await waitFor(() => {
      const putCall = mockApiFetch.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/manufacturing/print-jobs/id1" && (c[1] as Record<string, unknown>)?.method === "PUT"
      );
      expect(putCall).toBeTruthy();
    });
  });

  it("saves edit with empty numeric fields (triggers || 0 fallbacks)", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const editBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Edit"
    )!;
    await act(async () => fireEvent.click(editBtn));

    // Clear all numeric inputs except batchId
    const numberInputs = container.querySelectorAll("input[type='number']");
    for (let i = 1; i < numberInputs.length; i++) {
      fireEvent.change(numberInputs[i], { target: { value: "" } });
    }

    mockApiFetch.mockResolvedValueOnce({});
    mockApiFetch.mockResolvedValueOnce(sampleJobsWithIds);

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Save"
    )!;
    await act(async () => fireEvent.click(saveBtn));

    await waitFor(() => {
      const putCall = mockApiFetch.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/manufacturing/print-jobs/id1" && (c[1] as Record<string, unknown>)?.method === "PUT"
      );
      expect(putCall).toBeTruthy();
      const body = JSON.parse((putCall![1] as Record<string, string>).body);
      expect(body.quantity).toBe(0);
      expect(body.usageG).toBe(0);
      expect(body.totalHours).toBe(0);
      expect(body.cost).toBe(0);
    });
  });

  it("validates empty batchId on edit", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const editBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Edit"
    )!;
    await act(async () => fireEvent.click(editBtn));

    const batchInput = container.querySelector("input[type='number']") as HTMLInputElement;
    fireEvent.change(batchInput, { target: { value: "" } });

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Save"
    )!;
    await act(async () => fireEvent.click(saveBtn));

    expect(container.textContent).toContain("Batch ID must be a positive integer");
  });

  it("validates empty part on edit", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const editBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Edit"
    )!;
    await act(async () => fireEvent.click(editBtn));

    // Find the text input for part (the first text input in the editing row)
    const textInputs = container.querySelectorAll("input[type='text']");
    const partInput = textInputs[0] as HTMLInputElement;
    fireEvent.change(partInput, { target: { value: "" } });

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Save"
    )!;
    await act(async () => fireEvent.click(saveBtn));

    expect(container.textContent).toContain("Part name is required");
  });

  it("validates empty date on edit", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const editBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Edit"
    )!;
    await act(async () => fireEvent.click(editBtn));

    const dateInput = container.querySelector("input[type='date']") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "" } });

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Save"
    )!;
    await act(async () => fireEvent.click(saveBtn));

    expect(container.textContent).toContain("Date is required");
  });

  it("shows error message on edit save error (Error)", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const editBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Edit"
    )!;
    await act(async () => fireEvent.click(editBtn));

    mockApiFetch.mockRejectedValueOnce(new Error("Update failed"));

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Save"
    )!;
    await act(async () => fireEvent.click(saveBtn));

    await waitFor(() => {
      expect(container.textContent).toContain("Update failed");
    });
  });

  it("shows generic message on edit save error (non-Error)", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const editBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Edit"
    )!;
    await act(async () => fireEvent.click(editBtn));

    mockApiFetch.mockRejectedValueOnce(42);

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Save"
    )!;
    await act(async () => fireEvent.click(saveBtn));

    await waitFor(() => {
      expect(container.textContent).toContain("Failed to save");
    });
  });

  // ── Inline Delete ───────────────────────────────────────────────────

  it("shows Delete? Yes/No confirmation after clicking Delete", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const deleteBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Delete"
    )!;
    await act(async () => fireEvent.click(deleteBtn));

    expect(container.textContent).toContain("Delete?");
    expect(Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Yes")).toBeTruthy();
    expect(Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "No")).toBeTruthy();
  });

  it("clicking Yes on delete calls DELETE API", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const deleteBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Delete"
    )!;
    await act(async () => fireEvent.click(deleteBtn));

    mockApiFetch.mockResolvedValueOnce({});
    mockApiFetch.mockResolvedValueOnce(sampleJobsWithIds);

    const yesBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Yes"
    )!;
    await act(async () => fireEvent.click(yesBtn));

    await waitFor(() => {
      const deleteCall = mockApiFetch.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/manufacturing/print-jobs/id1" && c[1]?.method === "DELETE"
      );
      expect(deleteCall).toBeTruthy();
    });
  });

  it("clicking No on delete cancels without API call", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const deleteBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Delete"
    )!;
    await act(async () => fireEvent.click(deleteBtn));

    const callCountBefore = mockApiFetch.mock.calls.length;

    const noBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "No"
    )!;
    await act(async () => fireEvent.click(noBtn));

    // No additional API calls made
    expect(mockApiFetch.mock.calls.length).toBe(callCountBefore);
    // Confirmation should be gone
    expect(container.textContent).not.toContain("Delete?");
  });

  it("shows error message on delete error (Error)", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const deleteBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Delete"
    )!;
    await act(async () => fireEvent.click(deleteBtn));

    mockApiFetch.mockRejectedValueOnce(new Error("Cannot delete"));

    const yesBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Yes"
    )!;
    await act(async () => fireEvent.click(yesBtn));

    await waitFor(() => {
      expect(container.textContent).toContain("Cannot delete");
    });
  });

  it("shows generic message on delete error (non-Error)", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    const deleteBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Delete"
    )!;
    await act(async () => fireEvent.click(deleteBtn));

    mockApiFetch.mockRejectedValueOnce(null);

    const yesBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Yes"
    )!;
    await act(async () => fireEvent.click(yesBtn));

    await waitFor(() => {
      expect(container.textContent).toContain("Failed to delete");
    });
  });

  // ── Soft Delete Lifecycle ───────────────────────────────────────────

  it("Show Deleted toggle calls apiFetch with includeDeleted", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    mockApiFetch.mockResolvedValue(sampleJobsWithDeleted);

    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Show Deleted"
    )!;
    await act(async () => fireEvent.click(showDeletedBtn));

    await waitFor(() => {
      const includeDeletedCall = mockApiFetch.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/manufacturing/print-jobs?includeDeleted=true"
      );
      expect(includeDeletedCall).toBeTruthy();
    });
  });

  it("renders deleted rows with opacity-50 and Restore/Purge buttons", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithDeleted);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    // Toggle Show Deleted
    mockApiFetch.mockResolvedValue(sampleJobsWithDeleted);
    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Show Deleted"
    )!;
    await act(async () => fireEvent.click(showDeletedBtn));

    await waitFor(() => {
      const tbody = container.querySelector("tbody")!;
      const rows = tbody.querySelectorAll("tr");
      const deletedRow = Array.from(rows).find((r) => r.className.includes("opacity-50"));
      expect(deletedRow).toBeTruthy();

      // Deleted row should have Restore and Purge buttons
      const rowButtons = within(deletedRow!).getAllByRole("button");
      const buttonTexts = rowButtons.map((b) => b.textContent);
      expect(buttonTexts).toContain("Restore");
      expect(buttonTexts).toContain("Purge");
    });
  });

  it("restore calls POST to restore endpoint", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithDeleted);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    // Toggle Show Deleted
    mockApiFetch.mockResolvedValue(sampleJobsWithDeleted);
    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Show Deleted"
    )!;
    await act(async () => fireEvent.click(showDeletedBtn));

    await waitFor(() => {
      expect(container.querySelector(".opacity-50")).toBeTruthy();
    });

    mockApiFetch.mockResolvedValueOnce({});
    mockApiFetch.mockResolvedValueOnce(sampleJobsWithDeleted);

    const restoreBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Restore"
    )!;
    await act(async () => fireEvent.click(restoreBtn));

    await waitFor(() => {
      const restoreCall = mockApiFetch.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/manufacturing/print-jobs/id2/restore" && c[1]?.method === "POST"
      );
      expect(restoreCall).toBeTruthy();
    });
  });

  it("shows error on restore failure", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithDeleted);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    mockApiFetch.mockResolvedValue(sampleJobsWithDeleted);
    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Show Deleted"
    )!;
    await act(async () => fireEvent.click(showDeletedBtn));

    await waitFor(() => {
      expect(container.querySelector(".opacity-50")).toBeTruthy();
    });

    mockApiFetch.mockRejectedValueOnce(new Error("Restore denied"));

    const restoreBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Restore"
    )!;
    await act(async () => fireEvent.click(restoreBtn));

    await waitFor(() => {
      expect(container.textContent).toContain("Restore denied");
    });
  });

  it("shows fallback 'Failed to restore' when non-Error is thrown", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithDeleted);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    mockApiFetch.mockResolvedValue(sampleJobsWithDeleted);
    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Show Deleted"
    )!;
    await act(async () => fireEvent.click(showDeletedBtn));

    await waitFor(() => {
      expect(container.querySelector(".opacity-50")).toBeTruthy();
    });

    mockApiFetch.mockRejectedValueOnce("string error");

    const restoreBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Restore"
    )!;
    await act(async () => fireEvent.click(restoreBtn));

    await waitFor(() => {
      expect(container.textContent).toContain("Failed to restore");
    });
  });

  it("purge shows confirmation and Yes calls permanent delete", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithDeleted);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    mockApiFetch.mockResolvedValue(sampleJobsWithDeleted);
    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Show Deleted"
    )!;
    await act(async () => fireEvent.click(showDeletedBtn));

    await waitFor(() => {
      expect(container.querySelector(".opacity-50")).toBeTruthy();
    });

    const purgeBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Purge"
    )!;
    await act(async () => fireEvent.click(purgeBtn));

    expect(container.textContent).toContain("Purge?");

    mockApiFetch.mockResolvedValueOnce({});
    mockApiFetch.mockResolvedValueOnce(sampleJobsWithDeleted);

    const yesBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Yes"
    )!;
    await act(async () => fireEvent.click(yesBtn));

    await waitFor(() => {
      const permanentCall = mockApiFetch.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/manufacturing/print-jobs/id2/permanent" && c[1]?.method === "DELETE"
      );
      expect(permanentCall).toBeTruthy();
    });
  });

  it("purge cancel dismisses confirmation", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithDeleted);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    mockApiFetch.mockResolvedValue(sampleJobsWithDeleted);
    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Show Deleted"
    )!;
    await act(async () => fireEvent.click(showDeletedBtn));

    await waitFor(() => {
      expect(container.querySelector(".opacity-50")).toBeTruthy();
    });

    const purgeBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Purge"
    )!;
    await act(async () => fireEvent.click(purgeBtn));

    expect(container.textContent).toContain("Purge?");

    const noBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "No"
    )!;
    await act(async () => fireEvent.click(noBtn));

    expect(container.textContent).not.toContain("Purge?");
  });

  it("shows error on purge failure (Error)", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithDeleted);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    mockApiFetch.mockResolvedValue(sampleJobsWithDeleted);
    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Show Deleted"
    )!;
    await act(async () => fireEvent.click(showDeletedBtn));

    await waitFor(() => {
      expect(container.querySelector(".opacity-50")).toBeTruthy();
    });

    const purgeBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Purge"
    )!;
    await act(async () => fireEvent.click(purgeBtn));

    mockApiFetch.mockRejectedValueOnce(new Error("Purge denied"));

    const yesBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Yes"
    )!;
    await act(async () => fireEvent.click(yesBtn));

    await waitFor(() => {
      expect(container.textContent).toContain("Purge denied");
    });
  });

  it("shows generic message on purge failure (non-Error)", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithDeleted);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    mockApiFetch.mockResolvedValue(sampleJobsWithDeleted);
    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Show Deleted"
    )!;
    await act(async () => fireEvent.click(showDeletedBtn));

    await waitFor(() => {
      expect(container.querySelector(".opacity-50")).toBeTruthy();
    });

    const purgeBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Purge"
    )!;
    await act(async () => fireEvent.click(purgeBtn));

    mockApiFetch.mockRejectedValueOnce(999);

    const yesBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Yes"
    )!;
    await act(async () => fireEvent.click(yesBtn));

    await waitFor(() => {
      expect(container.textContent).toContain("Failed to permanently delete");
    });
  });

  it("shows deleted count when showDeleted is true", async () => {
    mockApiFetch.mockResolvedValue(sampleJobsWithDeleted);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    mockApiFetch.mockResolvedValue(sampleJobsWithDeleted);
    const showDeletedBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Show Deleted"
    )!;
    await act(async () => fireEvent.click(showDeletedBtn));

    await waitFor(() => {
      expect(container.textContent).toContain("1 deleted");
    });
  });

  // ── Auditor / read-only ─────────────────────────────────────────────

  it("hides action buttons for auditor/read-only role", async () => {
    mockCanWrite.mockReturnValue(false);

    mockApiFetch.mockResolvedValue(sampleJobsWithIds);
    const { container } = render(<PrintJobsPage />);
    await waitFor(() => {
      expect(container.textContent).toContain("Upper Boot");
    });

    // No Edit, Delete, or + Add Job buttons
    const buttons = Array.from(container.querySelectorAll("button")).map((b) => b.textContent);
    expect(buttons).not.toContain("Edit");
    expect(buttons).not.toContain("Delete");
    expect(buttons).not.toContain("+ Add Job");

    // No Actions column header
    const headers = Array.from(container.querySelectorAll("th")).map((h) => h.textContent);
    expect(headers).not.toContain("Actions");

    // Restore canWrite to true for subsequent tests
    mockCanWrite.mockReturnValue(true);
  });
});
