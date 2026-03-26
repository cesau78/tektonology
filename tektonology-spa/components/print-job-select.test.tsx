import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";
import { PrintJobSelect } from "./print-job-select";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({
  useApiFetch: () => mockApiFetch,
}));

const jobs = [
  {
    _id: "job1",
    project: "Kneeler Boots",
    effective: "2026-03-01",
    outcome: "success",
    components: [
      { part: "Upper Boot", quantity: 2 },
      { part: "Floor Pad", quantity: 1 },
    ],
  },
  {
    _id: "job2",
    project: "Bait Station",
    effective: "2026-03-10",
    outcome: "partial",
    components: [],
  },
];

describe("PrintJobSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders with loading state (no options beyond default while fetching)", async () => {
    let resolveApiFetch: (value: unknown) => void;
    mockApiFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveApiFetch = resolve;
      }),
    );

    const onChange = vi.fn();
    const { container } = render(
      <PrintJobSelect value="" onChange={onChange} />,
    );

    const select = container.querySelector("select")!;
    const options = select.querySelectorAll("option");
    // Only the default "— None —" option while loading
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toBe("— None —");

    // Resolve to avoid act warnings
    await act(async () => {
      resolveApiFetch!(jobs);
    });
  });

  it("renders options after fetch resolves", async () => {
    mockApiFetch.mockResolvedValueOnce(jobs);

    const onChange = vi.fn();
    let container: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <PrintJobSelect value="" onChange={onChange} />,
      ));
    });

    const select = container!.querySelector("select")!;
    const options = select.querySelectorAll("option");
    // Default + 2 jobs
    expect(options).toHaveLength(3);
    expect(options[0].textContent).toBe("— None —");
    // Job with components shows parts
    expect(options[1].textContent).toBe(
      "2026-03-01 — Kneeler Boots — success (2× Upper Boot, 1× Floor Pad)",
    );
    // Job with no components — no parts suffix
    expect(options[2].textContent).toBe(
      "2026-03-10 — Bait Station — partial",
    );
  });

  it("calls onChange with id and job object when a job is selected", async () => {
    mockApiFetch.mockResolvedValueOnce(jobs);

    const onChange = vi.fn();
    let container: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <PrintJobSelect value="" onChange={onChange} />,
      ));
    });

    const select = container!.querySelector("select")!;
    fireEvent.change(select, { target: { value: "job1" } });

    expect(onChange).toHaveBeenCalledWith("job1", jobs[0]);
  });

  it("calls onChange with id and undefined when selecting the empty option", async () => {
    mockApiFetch.mockResolvedValueOnce(jobs);

    const onChange = vi.fn();
    let container: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <PrintJobSelect value="job1" onChange={onChange} />,
      ));
    });

    const select = container!.querySelector("select")!;
    fireEvent.change(select, { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith("", undefined);
  });

  it("handles fetch error by setting jobs to empty array", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("Network error"));

    const onChange = vi.fn();
    let container: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <PrintJobSelect value="" onChange={onChange} />,
      ));
    });

    const select = container!.querySelector("select")!;
    const options = select.querySelectorAll("option");
    // Only the default option — no jobs loaded
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toBe("— None —");
  });

  it("sets the select value from the value prop", async () => {
    mockApiFetch.mockResolvedValueOnce(jobs);

    const onChange = vi.fn();
    let container: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <PrintJobSelect value="job2" onChange={onChange} />,
      ));
    });

    const select = container!.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("job2");
  });
});
