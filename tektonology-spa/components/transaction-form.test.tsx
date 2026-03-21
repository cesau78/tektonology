import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent, act, within } from "@testing-library/react";
import { TransactionForm } from "./transaction-form";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({
  useApiFetch: () => mockApiFetch,
}));

const accounts = [
  { number: 5100, name: "Filament", type: "expense" },
  { number: 5200, name: "Shipping", type: "expense" },
  { number: 1000, name: "Cash", type: "asset" },
  { number: 2000, name: "Credit Card", type: "liability" },
  { number: 3000, name: "Owner Equity", type: "equity" },
  { number: 4000, name: "Sales", type: "revenue" },
  { number: 5300, name: "Cost of Goods", type: "cogs" },
];

function fillBalancedEntry(container: HTMLElement) {
  const view = within(container);

  // Set description
  const descInput = view.getByPlaceholderText("e.g. Bambu P1S Combo purchase");
  fireEvent.change(descInput, { target: { value: "Test transaction" } });

  // Select accounts
  const allSelects = view.getAllByRole("combobox");
  // selects are: account0, side0, account1, side1
  fireEvent.change(allSelects[0], { target: { value: "5100" } });
  fireEvent.change(allSelects[2], { target: { value: "1000" } });

  // Set amounts
  const amountInputs = view.getAllByPlaceholderText("0.00");
  fireEvent.change(amountInputs[0], { target: { value: "10.00" } });
  fireEvent.change(amountInputs[1], { target: { value: "10.00" } });
}

describe("TransactionForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("renders default state with accounts grouped by type in correct order", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    expect(view.getByText("Transaction Details")).toBeInTheDocument();
    expect(view.getByText("Line Items")).toBeInTheDocument();
    expect(view.getByText("+ Add Line")).toBeInTheDocument();
    expect(view.getByText("Save Transaction")).toBeInTheDocument();

    // Two default lines, each with account/side/amount/memo
    expect(view.getAllByText("Account")).toHaveLength(2);
    expect(view.getAllByText("Side")).toHaveLength(2);
    expect(view.getAllByText("Amount")).toHaveLength(2);
    expect(view.getAllByText("Memo")).toHaveLength(2);

    // Verify account grouping: optgroups exist in typeOrder
    const optgroups = container.querySelectorAll("optgroup");
    const labels = Array.from(optgroups).map((g) => g.getAttribute("label"));
    expect(labels).toContain("Expense");
    expect(labels).toContain("Asset");
    expect(labels).toContain("Liability");
    expect(labels).toContain("Equity");
    expect(labels).toContain("Revenue");
    expect(labels).toContain("Cogs");

    // Verify ordering: Expense before Asset before Liability etc.
    const expenseIdx = labels.indexOf("Expense");
    const assetIdx = labels.indexOf("Asset");
    const liabilityIdx = labels.indexOf("Liability");
    const equityIdx = labels.indexOf("Equity");
    const revenueIdx = labels.indexOf("Revenue");
    const cogsIdx = labels.indexOf("Cogs");
    expect(expenseIdx).toBeLessThan(assetIdx);
    expect(assetIdx).toBeLessThan(liabilityIdx);
    expect(liabilityIdx).toBeLessThan(equityIdx);
    expect(equityIdx).toBeLessThan(revenueIdx);
    expect(revenueIdx).toBeLessThan(cogsIdx);

    // Default totals — both Debits and Credits show $0.00
    const zeroAmounts = view.getAllByText("$0.00");
    expect(zeroAmounts.length).toBe(2);
  });

  it("renders accounts that exist in a type not in typeOrder are excluded", () => {
    const customAccounts = [
      { number: 9999, name: "Mystery", type: "mystery" },
      { number: 1000, name: "Cash", type: "asset" },
    ];
    const { container } = render(<TransactionForm accounts={customAccounts} />);

    // Only "Asset" optgroup should appear (mystery is not in typeOrder)
    const optgroups = container.querySelectorAll("optgroup");
    const labels = Array.from(optgroups).map((g) => g.getAttribute("label"));
    expect(labels).toContain("Asset");
    expect(labels).not.toContain("Mystery");
  });

  it("adds a line when clicking + Add Line", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    expect(view.getAllByText("Account")).toHaveLength(2);

    fireEvent.click(view.getByText("+ Add Line"));

    expect(view.getAllByText("Account")).toHaveLength(3);
  });

  it("does not remove a line when only 2 lines exist (minimum enforced)", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    const removeButtons = view.getAllByText("x");
    expect(removeButtons).toHaveLength(2);

    // All remove buttons should be disabled
    removeButtons.forEach((btn) => {
      expect(btn.closest("button")).toBeDisabled();
    });

    // Click anyway — should not reduce lines
    fireEvent.click(removeButtons[0]);
    expect(view.getAllByText("Account")).toHaveLength(2);
  });

  it("removes a line when more than 2 lines exist", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    // Add a third line
    fireEvent.click(view.getByText("+ Add Line"));
    expect(view.getAllByText("Account")).toHaveLength(3);

    // Remove buttons should now be enabled
    const removeButtons = view.getAllByText("x");
    expect(removeButtons[0].closest("button")).not.toBeDisabled();

    fireEvent.click(removeButtons[0]);
    expect(view.getAllByText("Account")).toHaveLength(2);
  });

  it("selects an account for a line", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    const allSelects = view.getAllByRole("combobox");
    fireEvent.change(allSelects[0], { target: { value: "5100" } });

    expect((allSelects[0] as HTMLSelectElement).value).toBe("5100");
  });

  it("clears account selection when empty string selected", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    const allSelects = view.getAllByRole("combobox");
    // Select then deselect
    fireEvent.change(allSelects[0], { target: { value: "5100" } });
    fireEvent.change(allSelects[0], { target: { value: "" } });

    expect((allSelects[0] as HTMLSelectElement).value).toBe("");
  });

  it("toggles debit/credit side", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    const allSelects = view.getAllByRole("combobox");
    // Side selects are at index 1 and 3
    fireEvent.change(allSelects[1], { target: { value: "credit" } });
    expect((allSelects[1] as HTMLSelectElement).value).toBe("credit");

    fireEvent.change(allSelects[1], { target: { value: "debit" } });
    expect((allSelects[1] as HTMLSelectElement).value).toBe("debit");
  });

  it("sets amount on a line", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    const amountInputs = view.getAllByPlaceholderText("0.00");
    fireEvent.change(amountInputs[0], { target: { value: "25.50" } });

    expect((amountInputs[0] as HTMLInputElement).value).toBe("25.50");
  });

  it("sets memo on a line", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    const memoInputs = view.getAllByPlaceholderText("Line memo...");
    fireEvent.change(memoInputs[0], { target: { value: "Test memo" } });

    expect((memoInputs[0] as HTMLInputElement).value).toBe("Test memo");
  });

  it("sets the date", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    const dateInput = view.getByDisplayValue(/\d{4}-\d{2}-\d{2}/);
    fireEvent.change(dateInput, { target: { value: "2026-01-15" } });

    expect((dateInput as HTMLInputElement).value).toBe("2026-01-15");
  });

  it("sets the description", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    const descInput = view.getByPlaceholderText("e.g. Bambu P1S Combo purchase");
    fireEvent.change(descInput, { target: { value: "New description" } });

    expect((descInput as HTMLInputElement).value).toBe("New description");
  });

  it("shows balanced badge when debits equal credits and totalDebit > 0", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    const amountInputs = view.getAllByPlaceholderText("0.00");
    fireEvent.change(amountInputs[0], { target: { value: "10.00" } });
    fireEvent.change(amountInputs[1], { target: { value: "10.00" } });

    expect(view.getByText("Balanced")).toBeInTheDocument();
  });

  it("shows unbalanced badge with difference when debits != credits and totalDebit > 0", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    const amountInputs = view.getAllByPlaceholderText("0.00");

    // Line 0 defaults to debit, line 1 defaults to credit
    fireEvent.change(amountInputs[0], { target: { value: "15.00" } });
    fireEvent.change(amountInputs[1], { target: { value: "10.00" } });

    // totalDebit = 15, totalCredit = 10, off by $5.00
    expect(view.getByText("Off by $5.00")).toBeInTheDocument();
  });

  it("does not show badge when totalDebit is 0", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    // No amounts set, totalDebit = 0
    expect(view.queryByText("Balanced")).not.toBeInTheDocument();
    expect(view.queryByText(/Off by/)).not.toBeInTheDocument();
  });

  it("disables save button when entry is unbalanced", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    const saveBtn = view.getByText("Save Transaction");
    expect(saveBtn.closest("button")).toBeDisabled();
  });

  it("disables save button when description is empty", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    const allSelects = view.getAllByRole("combobox");
    fireEvent.change(allSelects[0], { target: { value: "5100" } });
    fireEvent.change(allSelects[2], { target: { value: "1000" } });

    const amountInputs = view.getAllByPlaceholderText("0.00");
    fireEvent.change(amountInputs[0], { target: { value: "10.00" } });
    fireEvent.change(amountInputs[1], { target: { value: "10.00" } });

    // Description is empty
    const saveBtn = view.getByText("Save Transaction");
    expect(saveBtn.closest("button")).toBeDisabled();
  });

  it("disables save button when account is not selected", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    const descInput = view.getByPlaceholderText("e.g. Bambu P1S Combo purchase");
    fireEvent.change(descInput, { target: { value: "Test" } });

    const amountInputs = view.getAllByPlaceholderText("0.00");
    fireEvent.change(amountInputs[0], { target: { value: "10.00" } });
    fireEvent.change(amountInputs[1], { target: { value: "10.00" } });

    // No accounts selected
    const saveBtn = view.getByText("Save Transaction");
    expect(saveBtn.closest("button")).toBeDisabled();
  });

  it("disables save button when amount is 0 or empty", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    const descInput = view.getByPlaceholderText("e.g. Bambu P1S Combo purchase");
    fireEvent.change(descInput, { target: { value: "Test" } });

    const allSelects = view.getAllByRole("combobox");
    fireEvent.change(allSelects[0], { target: { value: "5100" } });
    fireEvent.change(allSelects[2], { target: { value: "1000" } });

    // Amounts are empty
    const saveBtn = view.getByText("Save Transaction");
    expect(saveBtn.closest("button")).toBeDisabled();
  });

  it("enables save button when entry is balanced, all fields filled, and description set", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);

    fillBalancedEntry(container);

    const view = within(container);
    const saveBtn = view.getByText("Save Transaction");
    expect(saveBtn.closest("button")).not.toBeDisabled();
  });

  it("saves a balanced entry successfully and shows success message", async () => {
    mockApiFetch.mockResolvedValueOnce({ ok: true });

    const { container } = render(<TransactionForm accounts={accounts} />);

    fillBalancedEntry(container);

    const view = within(container);
    const saveBtn = view.getByText("Save Transaction");
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // Verify apiFetch was called correctly
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/finance/journal",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );

    // Parse the body to verify structure
    const callArgs = mockApiFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.description).toBe("Test transaction");
    expect(body.lines).toHaveLength(2);
    expect(body.lines[0].accountNumber).toBe(5100);
    expect(body.lines[0].accountName).toBe("Filament");
    expect(body.lines[0].debit).toBe(10);
    expect(body.lines[0].credit).toBeNull();
    expect(body.lines[1].accountNumber).toBe(1000);
    expect(body.lines[1].accountName).toBe("Cash");
    expect(body.lines[1].debit).toBeNull();
    expect(body.lines[1].credit).toBe(10);

    // Shows success card
    expect(
      view.getByText("Transaction saved. Redirecting to journal..."),
    ).toBeInTheDocument();

    // Advances timer to trigger redirect
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockPush).toHaveBeenCalledWith("/finance/journal");
  });

  it("shows error when API call fails with Error instance", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("Network failure"));

    const { container } = render(<TransactionForm accounts={accounts} />);

    fillBalancedEntry(container);

    const view = within(container);
    const saveBtn = view.getByText("Save Transaction");
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(view.getByText("Network failure")).toBeInTheDocument();
    // Should not show success
    expect(
      view.queryByText("Transaction saved. Redirecting to journal..."),
    ).not.toBeInTheDocument();
  });

  it("shows generic error when API call fails with non-Error", async () => {
    mockApiFetch.mockRejectedValueOnce("some string error");

    const { container } = render(<TransactionForm accounts={accounts} />);

    fillBalancedEntry(container);

    const view = within(container);
    const saveBtn = view.getByText("Save Transaction");
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(view.getByText("Failed to save")).toBeInTheDocument();
  });

  it("shows 'Saving...' text while save is in progress", async () => {
    let resolveApiFetch: (value: unknown) => void;
    mockApiFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveApiFetch = resolve;
      }),
    );

    const { container } = render(<TransactionForm accounts={accounts} />);

    fillBalancedEntry(container);

    const view = within(container);
    const saveBtn = view.getByText("Save Transaction");
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(view.getByText("Saving...")).toBeInTheDocument();

    // Resolve the promise
    await act(async () => {
      resolveApiFetch!({ ok: true });
    });
  });

  it("handles credit side line in save payload", async () => {
    mockApiFetch.mockResolvedValueOnce({ ok: true });

    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    const descInput = view.getByPlaceholderText("e.g. Bambu P1S Combo purchase");
    fireEvent.change(descInput, { target: { value: "Credit test" } });

    const allSelects = view.getAllByRole("combobox");
    // First line: account = Filament, side stays debit (default)
    fireEvent.change(allSelects[0], { target: { value: "5100" } });

    // Second line: account = Cash, side is already credit (default for second line)
    fireEvent.change(allSelects[2], { target: { value: "1000" } });

    const amountInputs = view.getAllByPlaceholderText("0.00");
    fireEvent.change(amountInputs[0], { target: { value: "5.50" } });
    fireEvent.change(amountInputs[1], { target: { value: "5.50" } });

    const memoInputs = view.getAllByPlaceholderText("Line memo...");
    fireEvent.change(memoInputs[0], { target: { value: "Debit memo" } });
    fireEvent.change(memoInputs[1], { target: { value: "Credit memo" } });

    const saveBtn = view.getByText("Save Transaction");
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    const body = JSON.parse(mockApiFetch.mock.calls[0][1].body);
    expect(body.lines[0].debit).toBe(5.5);
    expect(body.lines[0].credit).toBeNull();
    expect(body.lines[0].description).toBe("Debit memo");
    expect(body.lines[1].debit).toBeNull();
    expect(body.lines[1].credit).toBe(5.5);
    expect(body.lines[1].description).toBe("Credit memo");
  });

  it("includes accountName in save payload", async () => {
    mockApiFetch.mockResolvedValueOnce({ ok: true });

    const limitedAccounts = [
      { number: 1000, name: "Cash", type: "asset" },
      { number: 2000, name: "Credit Card", type: "liability" },
    ];

    const { container } = render(<TransactionForm accounts={limitedAccounts} />);
    const view = within(container);

    const descInput = view.getByPlaceholderText("e.g. Bambu P1S Combo purchase");
    fireEvent.change(descInput, { target: { value: "Test" } });

    const allSelects = view.getAllByRole("combobox");
    fireEvent.change(allSelects[0], { target: { value: "1000" } });
    fireEvent.change(allSelects[2], { target: { value: "2000" } });

    const amountInputs = view.getAllByPlaceholderText("0.00");
    fireEvent.change(amountInputs[0], { target: { value: "10" } });
    fireEvent.change(amountInputs[1], { target: { value: "10" } });

    const saveBtn = view.getByText("Save Transaction");
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    const body = JSON.parse(mockApiFetch.mock.calls[0][1].body);
    expect(body.lines[0].accountName).toBe("Cash");
    expect(body.lines[1].accountName).toBe("Credit Card");
  });

  it("applies border-emerald-300 class when balanced with totalDebit > 0", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    const amountInputs = view.getAllByPlaceholderText("0.00");
    fireEvent.change(amountInputs[0], { target: { value: "10" } });
    fireEvent.change(amountInputs[1], { target: { value: "10" } });

    // The balance card should have emerald border
    const cards = container.querySelectorAll(".border-emerald-300");
    expect(cards.length).toBeGreaterThan(0);
  });

  it("applies border-red-300 class when unbalanced with totalDebit > 0", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    const amountInputs = view.getAllByPlaceholderText("0.00");
    fireEvent.change(amountInputs[0], { target: { value: "10" } });
    // second line is credit side with no amount — unbalanced

    const cards = container.querySelectorAll(".border-red-300");
    expect(cards.length).toBeGreaterThan(0);
  });

  it("applies no special border class when totalDebit is 0", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);

    // No amounts set — no emerald or red border on balance card
    const emeraldCards = container.querySelectorAll(".shadow-sm.border-emerald-300");
    const redCards = container.querySelectorAll(".shadow-sm.border-red-300");
    expect(emeraldCards.length).toBe(0);
    expect(redCards.length).toBe(0);
  });

  it("handles today() producing correct date format", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    // Should match YYYY-MM-DD format
    expect(dateInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("considers entry balanced when difference is less than 0.005", () => {
    const { container } = render(<TransactionForm accounts={accounts} />);
    const view = within(container);

    const amountInputs = view.getAllByPlaceholderText("0.00");
    // Set amounts that differ by less than 0.005
    fireEvent.change(amountInputs[0], { target: { value: "10.001" } });
    fireEvent.change(amountInputs[1], { target: { value: "10.005" } });

    expect(view.getByText("Balanced")).toBeInTheDocument();
  });

  it("renders with empty accounts array", () => {
    const { container } = render(<TransactionForm accounts={[]} />);
    const view = within(container);

    expect(view.getByText("Transaction Details")).toBeInTheDocument();
    // No optgroups should be rendered
    const optgroups = container.querySelectorAll("optgroup");
    expect(optgroups.length).toBe(0);
  });

  it("sets saving back to false after API error (finally block)", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("Server error"));

    const { container } = render(<TransactionForm accounts={accounts} />);

    fillBalancedEntry(container);

    const view = within(container);
    const saveBtn = view.getByText("Save Transaction");
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // After error, saving should be false — button shows "Save Transaction" not "Saving..."
    expect(view.getByText("Save Transaction")).toBeInTheDocument();
    expect(view.queryByText("Saving...")).not.toBeInTheDocument();
  });

  it("clears previous saveError when saving again", async () => {
    mockApiFetch
      .mockRejectedValueOnce(new Error("First error"))
      .mockResolvedValueOnce({ ok: true });

    const { container } = render(<TransactionForm accounts={accounts} />);

    fillBalancedEntry(container);

    const view = within(container);

    // First save — should error
    const saveBtn = view.getByText("Save Transaction");
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    expect(view.getByText("First error")).toBeInTheDocument();

    // Second save — error should clear
    await act(async () => {
      fireEvent.click(view.getByText("Save Transaction"));
    });

    expect(view.queryByText("First error")).not.toBeInTheDocument();
  });
});
