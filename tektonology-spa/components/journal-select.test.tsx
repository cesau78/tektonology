import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";
import { JournalSelect } from "./journal-select";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({
  useApiFetch: () => mockApiFetch,
}));

const entries = [
  { transactionId: 1, effective: "2026-01-15", description: "Spool purchase" },
  { transactionId: 2, effective: "2026-02-01", description: "Plate order" },
];

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("JournalSelect", () => {
  it("renders default option while loading", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    const onChange = vi.fn();
    const { container } = render(<JournalSelect value="" onChange={onChange} />);

    const select = container.querySelector("select")!;
    const options = select.querySelectorAll("option");
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toBe("— None —");
  });

  it("renders journal entries after successful fetch", async () => {
    mockApiFetch.mockResolvedValueOnce(entries);

    const onChange = vi.fn();
    let container: HTMLElement;
    await act(async () => {
      ({ container } = render(<JournalSelect value="" onChange={onChange} />));
    });

    const select = container!.querySelector("select")!;
    const options = select.querySelectorAll("option");
    expect(options).toHaveLength(3); // default + 2 entries
    expect(options[0].textContent).toBe("— None —");
    expect(options[1].textContent).toBe("#1 — 2026-01-15 — Spool purchase");
    expect(options[2].textContent).toBe("#2 — 2026-02-01 — Plate order");
  });

  it("handles fetch failure by setting entries to empty array", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("Network error"));

    const onChange = vi.fn();
    let container: HTMLElement;
    await act(async () => {
      ({ container } = render(<JournalSelect value="" onChange={onChange} />));
    });

    const select = container!.querySelector("select")!;
    const options = select.querySelectorAll("option");
    // Only default option — no entries loaded
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toBe("— None —");
  });

  it("calls onChange when selection changes", async () => {
    mockApiFetch.mockResolvedValueOnce(entries);

    const onChange = vi.fn();
    let container: HTMLElement;
    await act(async () => {
      ({ container } = render(<JournalSelect value="" onChange={onChange} />));
    });

    const select = container!.querySelector("select")!;
    fireEvent.change(select, { target: { value: "1" } });
    expect(onChange).toHaveBeenCalledWith("1");
  });

  it("sets the select value from the value prop", async () => {
    mockApiFetch.mockResolvedValueOnce(entries);

    const onChange = vi.fn();
    let container: HTMLElement;
    await act(async () => {
      ({ container } = render(<JournalSelect value="2" onChange={onChange} />));
    });

    const select = container!.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("2");
  });
});
