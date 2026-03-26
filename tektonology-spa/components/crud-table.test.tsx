import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { CrudTable, Column } from "./crud-table";
import type { CrudState } from "@/lib/use-crud";

vi.mock("@/lib/auth", () => ({
  useRole: () => ({ role: "owner", isLoaded: true }),
  canWrite: () => true,
}));

vi.mock("@/lib/api", () => ({
  useApiFetch: () => vi.fn(),
}));

interface TestItem {
  id: number;
  name: string;
  value: string;
  deletedAt: string | null;
}

const sampleItems: TestItem[] = [
  { id: 1, name: "Alpha", value: "100", deletedAt: null },
  { id: 2, name: "Beta", value: "200", deletedAt: null },
  { id: 3, name: "Gamma", value: "300", deletedAt: "2026-01-01" },
];

const columns: Column<TestItem>[] = [
  { key: "name", label: "Name" },
  { key: "value", label: "Value", align: "right", mono: true },
];

const emptyFields = { name: "", value: "" };

function makeCrud(overrides: Partial<CrudState<TestItem>> = {}): CrudState<TestItem> {
  return {
    items: sampleItems,
    error: null,
    actionError: null,
    showDeleted: false,
    setShowDeleted: vi.fn(),
    setActionError: vi.fn(),
    load: vi.fn(),
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
    permanentDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderTable(crudOverrides: Partial<CrudState<TestItem>> = {}, props: Partial<Parameters<typeof CrudTable<TestItem>>[0]> = {}) {
  const crud = makeCrud(crudOverrides);
  const result = render(
    <CrudTable<TestItem>
      crud={crud}
      columns={columns}
      getId={(item) => item.id}
      isDeleted={(item) => item.deletedAt !== null}
      writable={true}
      emptyFields={emptyFields}
      title="Item"
      toPayload={(v) => ({ name: v.name, value: v.value }) as Partial<TestItem>}
      {...props}
    />,
  );
  return { ...result, crud };
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CrudTable", () => {
  // --- Rendering ---

  it("renders column headers", () => {
    const { container } = renderTable();
    const ths = container.querySelectorAll("th");
    expect(ths[0].textContent).toBe("Name");
    expect(ths[1].textContent).toBe("Value");
    expect(ths[2].textContent).toBe("Actions");
  });

  it("renders rows for non-deleted items when showDeleted is false", () => {
    const { container } = renderTable({ showDeleted: false });
    const rows = container.querySelectorAll("tbody tr");
    // Only Alpha and Beta visible (Gamma is deleted)
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Alpha");
    expect(rows[1].textContent).toContain("Beta");
  });

  it("renders all rows including deleted when showDeleted is true", () => {
    const { container } = renderTable({ showDeleted: true });
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(3);
    // Deleted row should have opacity class
    expect(rows[2].className).toContain("opacity-50");
  });

  it("renders right-aligned and mono columns correctly", () => {
    const { container } = renderTable();
    const valueCells = container.querySelectorAll("tbody td:nth-child(2)");
    expect(valueCells[0].className).toContain("text-right");
    expect(valueCells[0].className).toContain("font-mono");
  });

  it("hides Actions column when writable is false", () => {
    const { container } = renderTable({}, { writable: false });
    const ths = container.querySelectorAll("th");
    expect(ths).toHaveLength(2); // only Name and Value
    // No Edit or Delete action buttons in rows
    const actionBtns = [...container.querySelectorAll("tbody button")];
    expect(actionBtns).toHaveLength(0);
  });

  it("uses custom render function for column display", () => {
    const customColumns: Column<TestItem>[] = [
      { key: "name", label: "Name", render: (item) => `Custom: ${item.name}` },
      { key: "value", label: "Value" },
    ];
    const { container } = renderTable({}, { columns: customColumns });
    expect(container.textContent).toContain("Custom: Alpha");
  });

  // --- Loading and Error states ---

  it("shows loading state when items is null", () => {
    const { container } = renderTable({ items: null });
    expect(container.textContent).toContain("Loading...");
  });

  it("shows error state when error is set", () => {
    const { container } = renderTable({ error: "Something broke" });
    expect(container.textContent).toContain("Something broke");
  });

  it("displays actionError banner", () => {
    const { container } = renderTable({ actionError: "Failed to save" });
    expect(container.textContent).toContain("Failed to save");
  });

  // --- Show Deleted toggle ---

  it("toggles showDeleted on button click", () => {
    const { container, crud } = renderTable({ showDeleted: false });
    const btn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Show Deleted")!;
    fireEvent.click(btn);
    expect(crud.setShowDeleted).toHaveBeenCalledWith(true);
  });

  it("shows 'Hide Deleted' text when showDeleted is true", () => {
    const { container, crud } = renderTable({ showDeleted: true });
    const btn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Hide Deleted")!;
    expect(btn).toBeDefined();
    fireEvent.click(btn);
    expect(crud.setShowDeleted).toHaveBeenCalledWith(false);
  });

  // --- Add flow ---

  it("opens add form and saves new item", async () => {
    const { container, crud } = renderTable();
    const addBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Add Item"))!;
    fireEvent.click(addBtn);

    // The add form should be visible
    expect(container.textContent).toContain("New Item");

    // Fill in fields via auto-generated inputs
    const inputs = container.querySelectorAll(".border-dashed input");
    fireEvent.change(inputs[0], { target: { value: "NewName" } });
    fireEvent.change(inputs[1], { target: { value: "999" } });

    // Save
    const saveBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Save" && b.closest(".border-dashed"),
    )!;
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(crud.create).toHaveBeenCalledWith({ name: "NewName", value: "999" });
  });

  it("cancels add form", () => {
    const { container, crud } = renderTable();
    const addBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Add Item"))!;
    fireEvent.click(addBtn);
    expect(crud.setActionError).toHaveBeenCalledWith(null);

    const cancelBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Cancel" && b.closest(".border-dashed"),
    )!;
    fireEvent.click(cancelBtn);

    // Form should be gone
    expect(container.textContent).not.toContain("New Item");
  });

  it("add button is hidden when addingRow is true", () => {
    const { container } = renderTable();
    const addBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Add Item"))!;
    fireEvent.click(addBtn);
    // Now the add button should be gone
    const addBtnAfter = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Add Item"));
    expect(addBtnAfter).toBeUndefined();
  });

  it("handles add failure without crashing", async () => {
    const { container } = renderTable({}, {
      crud: makeCrud({ create: vi.fn().mockRejectedValue(new Error("fail")) }) as CrudState<TestItem>,
    });
    // Open form — need to re-render since we passed crud directly
    // Let's use a simpler approach
    const crud2 = makeCrud({ create: vi.fn().mockRejectedValue(new Error("fail")) });
    cleanup();
    const { container: c2 } = render(
      <CrudTable<TestItem>
        crud={crud2}
        columns={columns}
        getId={(item) => item.id}
        isDeleted={(item) => item.deletedAt !== null}
        writable={true}
        emptyFields={emptyFields}
        title="Item"
        toPayload={(v) => ({ name: v.name, value: v.value }) as Partial<TestItem>}
      />,
    );
    const addBtn = [...c2.querySelectorAll("button")].find((b) => b.textContent?.includes("Add Item"))!;
    fireEvent.click(addBtn);
    const saveBtn = [...c2.querySelectorAll("button")].find(
      (b) => b.textContent === "Save" && b.closest(".border-dashed"),
    )!;
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    // Should not crash; form stays open because create failed
    expect(c2.textContent).toContain("New Item");
  });

  // --- Add flow with renderForm ---

  it("uses renderForm callback for add form when provided", () => {
    const renderForm = vi.fn().mockImplementation((values, onChange) => (
      <div data-testid="custom-form">
        <input value={values.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange("name", e.target.value)} />
      </div>
    ));
    const { container } = renderTable({}, { renderForm });

    const addBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Add Item"))!;
    fireEvent.click(addBtn);

    expect(renderForm).toHaveBeenCalled();
    expect(container.querySelector("[data-testid='custom-form']")).toBeTruthy();

    // Test onChange propagation
    const input = container.querySelector("[data-testid='custom-form'] input")!;
    fireEvent.change(input, { target: { value: "Custom" } });
    // renderForm should be called again with updated values
    expect(renderForm).toHaveBeenCalledTimes(2);
  });

  // --- Edit flow ---

  it("enters edit mode and saves changes", async () => {
    const { container, crud } = renderTable();
    const editBtns = [...container.querySelectorAll("button")].filter((b) => b.textContent === "Edit");
    // Click Edit on first row
    fireEvent.click(editBtns[0]);
    expect(crud.setActionError).toHaveBeenCalledWith(null);

    // Edit inputs should appear in the row
    const rowInputs = container.querySelectorAll("tbody tr:first-child input");
    expect(rowInputs.length).toBeGreaterThan(0);

    fireEvent.change(rowInputs[0], { target: { value: "Updated" } });
    fireEvent.change(rowInputs[1], { target: { value: "999" } });

    const saveBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Save" && b.closest("tbody"),
    )!;
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(crud.update).toHaveBeenCalledWith(1, { name: "Updated", value: "999" });
  });

  it("cancels edit mode", () => {
    const { container, crud } = renderTable();
    const editBtns = [...container.querySelectorAll("button")].filter((b) => b.textContent === "Edit");
    fireEvent.click(editBtns[0]);

    const cancelBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Cancel" && b.closest("tbody"),
    )!;
    fireEvent.click(cancelBtn);
    expect(crud.setActionError).toHaveBeenCalledWith(null);

    // Should be back to normal display
    expect(container.querySelectorAll("tbody tr:first-child input")).toHaveLength(0);
  });

  it("uses fromItem to populate edit values when provided", () => {
    const fromItem = vi.fn().mockReturnValue({ name: "FromItem", value: "42" });
    const { container } = renderTable({}, { fromItem });
    const editBtns = [...container.querySelectorAll("button")].filter((b) => b.textContent === "Edit");
    fireEvent.click(editBtns[0]);

    expect(fromItem).toHaveBeenCalledWith(sampleItems[0]);
    const rowInputs = container.querySelectorAll("tbody tr:first-child input");
    expect((rowInputs[0] as HTMLInputElement).value).toBe("FromItem");
  });

  it("handles edit save failure without crashing", async () => {
    const crud = makeCrud({ update: vi.fn().mockRejectedValue(new Error("fail")) });
    const { container } = render(
      <CrudTable<TestItem>
        crud={crud}
        columns={columns}
        getId={(item) => item.id}
        isDeleted={(item) => item.deletedAt !== null}
        writable={true}
        emptyFields={emptyFields}
        title="Item"
        toPayload={(v) => ({ name: v.name, value: v.value }) as Partial<TestItem>}
      />,
    );

    const editBtns = [...container.querySelectorAll("button")].filter((b) => b.textContent === "Edit");
    fireEvent.click(editBtns[0]);
    const saveBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Save" && b.closest("tbody"),
    )!;
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    // Should remain in edit mode (editingId not cleared)
    expect(container.querySelectorAll("tbody tr:first-child input").length).toBeGreaterThan(0);
  });

  it("uses editRender for columns that provide it", () => {
    const editRender = vi.fn().mockImplementation((value: string, onChange: (v: string) => void) => (
      <select data-testid="custom-edit" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="a">A</option>
        <option value="b">B</option>
      </select>
    ));
    const customCols: Column<TestItem>[] = [
      { key: "name", label: "Name", editRender },
      { key: "value", label: "Value" },
    ];
    const { container } = renderTable({}, { columns: customCols });
    const editBtns = [...container.querySelectorAll("button")].filter((b) => b.textContent === "Edit");
    fireEvent.click(editBtns[0]);

    expect(container.querySelector("[data-testid='custom-edit']")).toBeTruthy();
    expect(editRender).toHaveBeenCalled();

    // Trigger onChange on the custom editRender
    const sel = container.querySelector("[data-testid='custom-edit']") as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: "b" } });
  });

  // --- Delete flow ---

  it("shows delete confirmation and deletes on confirm", async () => {
    const { container, crud } = renderTable();
    const deleteBtns = [...container.querySelectorAll("button")].filter((b) => b.textContent === "Delete");
    fireEvent.click(deleteBtns[0]);

    // Should show confirmation
    expect(container.textContent).toContain("Delete?");
    const yesBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Yes")!;

    await act(async () => {
      fireEvent.click(yesBtn);
    });

    expect(crud.remove).toHaveBeenCalledWith(1);
  });

  it("cancels delete confirmation", () => {
    const { container, crud } = renderTable();
    const deleteBtns = [...container.querySelectorAll("button")].filter((b) => b.textContent === "Delete");
    fireEvent.click(deleteBtns[0]);

    const noBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "No")!;
    fireEvent.click(noBtn);

    // Confirmation should be gone
    expect(container.textContent).not.toContain("Delete?");
    expect(crud.remove).not.toHaveBeenCalled();
  });

  it("handles delete failure without crashing", async () => {
    const crud = makeCrud({ remove: vi.fn().mockRejectedValue(new Error("fail")) });
    const { container } = render(
      <CrudTable<TestItem>
        crud={crud}
        columns={columns}
        getId={(item) => item.id}
        isDeleted={(item) => item.deletedAt !== null}
        writable={true}
        emptyFields={emptyFields}
        title="Item"
        toPayload={(v) => ({ name: v.name, value: v.value }) as Partial<TestItem>}
      />,
    );
    const deleteBtns = [...container.querySelectorAll("button")].filter((b) => b.textContent === "Delete");
    fireEvent.click(deleteBtns[0]);
    const yesBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Yes")!;
    await act(async () => {
      fireEvent.click(yesBtn);
    });
    expect(crud.remove).toHaveBeenCalledWith(1);
  });

  // --- Restore flow (deleted items) ---

  it("shows restore button for deleted items and restores", async () => {
    const { container, crud } = renderTable({ showDeleted: true });
    // Gamma is the deleted row (3rd row)
    const rows = container.querySelectorAll("tbody tr");
    const deletedRow = rows[2];
    const restoreBtn = [...deletedRow.querySelectorAll("button")].find((b) => b.textContent === "Restore")!;
    expect(restoreBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(restoreBtn);
    });

    expect(crud.restore).toHaveBeenCalledWith(3);
  });

  it("handles restore failure without crashing", async () => {
    const crud = makeCrud({
      showDeleted: true,
      restore: vi.fn().mockRejectedValue(new Error("fail")),
    });
    const { container } = render(
      <CrudTable<TestItem>
        crud={crud}
        columns={columns}
        getId={(item) => item.id}
        isDeleted={(item) => item.deletedAt !== null}
        writable={true}
        emptyFields={emptyFields}
        title="Item"
        toPayload={(v) => ({ name: v.name, value: v.value }) as Partial<TestItem>}
      />,
    );
    const rows = container.querySelectorAll("tbody tr");
    const deletedRow = rows[2];
    const restoreBtn = [...deletedRow.querySelectorAll("button")].find((b) => b.textContent === "Restore")!;
    await act(async () => {
      fireEvent.click(restoreBtn);
    });
    expect(crud.restore).toHaveBeenCalledWith(3);
  });

  // --- Purge flow (permanent delete) ---

  it("shows purge confirmation and permanently deletes", async () => {
    const { container, crud } = renderTable({ showDeleted: true });
    const rows = container.querySelectorAll("tbody tr");
    const deletedRow = rows[2];
    const purgeBtn = [...deletedRow.querySelectorAll("button")].find((b) => b.textContent === "Purge")!;
    fireEvent.click(purgeBtn);

    expect(container.textContent).toContain("Purge?");
    const yesBtn = [...deletedRow.querySelectorAll("button")].find((b) => b.textContent === "Yes")!;

    await act(async () => {
      fireEvent.click(yesBtn);
    });

    expect(crud.permanentDelete).toHaveBeenCalledWith(3);
  });

  it("cancels purge confirmation", () => {
    const { container, crud } = renderTable({ showDeleted: true });
    const rows = container.querySelectorAll("tbody tr");
    const deletedRow = rows[2];
    const purgeBtn = [...deletedRow.querySelectorAll("button")].find((b) => b.textContent === "Purge")!;
    fireEvent.click(purgeBtn);

    const noBtn = [...deletedRow.querySelectorAll("button")].find((b) => b.textContent === "No")!;
    fireEvent.click(noBtn);

    expect(container.textContent).not.toContain("Purge?");
    expect(crud.permanentDelete).not.toHaveBeenCalled();
  });

  it("handles permanent delete failure without crashing", async () => {
    const crud = makeCrud({
      showDeleted: true,
      permanentDelete: vi.fn().mockRejectedValue(new Error("fail")),
    });
    const { container } = render(
      <CrudTable<TestItem>
        crud={crud}
        columns={columns}
        getId={(item) => item.id}
        isDeleted={(item) => item.deletedAt !== null}
        writable={true}
        emptyFields={emptyFields}
        title="Item"
        toPayload={(v) => ({ name: v.name, value: v.value }) as Partial<TestItem>}
      />,
    );
    const rows = container.querySelectorAll("tbody tr");
    const deletedRow = rows[2];
    const purgeBtn = [...deletedRow.querySelectorAll("button")].find((b) => b.textContent === "Purge")!;
    fireEvent.click(purgeBtn);
    const yesBtn = [...deletedRow.querySelectorAll("button")].find((b) => b.textContent === "Yes")!;
    await act(async () => {
      fireEvent.click(yesBtn);
    });
    expect(crud.permanentDelete).toHaveBeenCalledWith(3);
  });

  // --- Column fallback rendering ---

  it("falls back to stringifying item property when no render function", () => {
    const { container } = renderTable();
    // "100" should appear as the value for Alpha
    const valueCells = container.querySelectorAll("tbody td:nth-child(2)");
    expect(valueCells[0].textContent).toBe("100");
  });

  // --- Edit input types ---

  it("renders edit inputs with placeholder matching field name", () => {
    const { container } = renderTable();
    const editBtns = [...container.querySelectorAll("button")].filter((b) => b.textContent === "Edit");
    fireEvent.click(editBtns[0]);

    const inputs = container.querySelectorAll("tbody tr:first-child input");
    expect((inputs[0] as HTMLInputElement).placeholder).toBe("name");
  });

  // --- Edge cases for branch coverage ---

  it("renders empty string for undefined item property (String fallback)", () => {
    // Add a column whose key doesn't exist on the item
    const colsWithMissing: Column<TestItem>[] = [
      { key: "name", label: "Name" },
      { key: "missing" as keyof TestItem & string, label: "Missing" },
    ];
    const { container } = renderTable({}, { columns: colsWithMissing });
    const cells = container.querySelectorAll("tbody td:nth-child(2)");
    // undefined key should render as ""
    expect(cells[0].textContent).toBe("");
  });

  it("shows non-editable column via render when editing (editValues key undefined)", () => {
    // Column "value" has a render function but is NOT in editValues
    const colsWithRender: Column<TestItem>[] = [
      { key: "name", label: "Name" },
      { key: "value", label: "Value", render: (item) => `Val:${item.value}` },
    ];
    // fromItem returns only "name" so "value" is undefined in editValues
    const fromItem = () => ({ name: "Test" });
    const { container } = renderTable({}, { columns: colsWithRender, fromItem });
    const editBtns = [...container.querySelectorAll("button")].filter((b) => b.textContent === "Edit");
    fireEvent.click(editBtns[0]);

    // The value column should show the render output (not an input) since editValues.value is undefined
    const valueCells = container.querySelectorAll("tbody tr:first-child td:nth-child(2)");
    expect(valueCells[0].textContent).toBe("Val:100");
  });

  it("editRender receives empty string when editValues key is undefined", () => {
    const editRender = vi.fn().mockImplementation((value: string) => (
      <span data-testid="edit-val">{value}</span>
    ));
    const colsWithEditRender: Column<TestItem>[] = [
      { key: "name", label: "Name" },
      { key: "extra", label: "Extra", editRender },
    ];
    // fromItem returns only "name" so "extra" is undefined in editValues
    const fromItem = () => ({ name: "Test" });
    const { container } = renderTable({}, { columns: colsWithEditRender, fromItem });
    const editBtns = [...container.querySelectorAll("button")].filter((b) => b.textContent === "Edit");
    fireEvent.click(editBtns[0]);

    // editRender should have been called with "" (the ?? "" fallback)
    expect(editRender).toHaveBeenCalledWith("", expect.any(Function));
  });

  it("handles left-aligned columns without align prop", () => {
    const colsLeft: Column<TestItem>[] = [
      { key: "name", label: "Name" },
    ];
    const { container } = renderTable({}, { columns: colsLeft });
    const th = container.querySelector("th")!;
    expect(th.className).toContain("text-left");
    const td = container.querySelector("tbody td")!;
    expect(td.className).not.toContain("text-right");
    expect(td.className).not.toContain("font-mono");
  });
});
