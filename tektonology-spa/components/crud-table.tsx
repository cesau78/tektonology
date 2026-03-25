"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/api-error";
import type { CrudState } from "@/lib/use-crud";

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  mono?: boolean;
  render?: (item: T) => React.ReactNode;
  editRender?: (value: string, onChange: (v: string) => void) => React.ReactNode;
}

interface CrudTableProps<T> {
  crud: CrudState<T>;
  columns: Column<T>[];
  getId: (item: T) => string | number;
  isDeleted: (item: T) => boolean;
  writable: boolean;
  emptyFields: Record<string, string>;
  title: string;
  toPayload: (values: Record<string, string>) => Partial<T>;
  fromItem?: (item: T) => Record<string, string>;
  /** Custom form renderer — replaces auto-generated grid with a responsive layout. */
  renderForm?: (
    values: Record<string, string>,
    onChange: (key: string, value: string) => void,
  ) => React.ReactNode;
}

export function CrudTable<T>({
  crud,
  columns,
  getId,
  isDeleted,
  writable,
  emptyFields,
  title,
  toPayload,
  fromItem,
  renderForm,
}: CrudTableProps<T>) {
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [addingRow, setAddingRow] = useState(false);
  const [newRow, setNewRow] = useState<Record<string, string>>({ ...emptyFields });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | number | null>(null);
  const [confirmPermanentId, setConfirmPermanentId] = useState<string | number | null>(null);
  const [busyId, setBusyId] = useState<string | number | null>(null);

  const startEdit = (item: T) => {
    const id = getId(item);
    setEditingId(id);
    setEditValues(fromItem ? fromItem(item) : { ...emptyFields });
    crud.setActionError(null);
  };

  const cancelEdit = () => { setEditingId(null); crud.setActionError(null); };

  const saveEdit = async (id: string | number) => {
    try {
      await crud.update(id, toPayload(editValues));
      setEditingId(null);
    } catch { /* actionError set by hook */ }
  };

  const handleAdd = async () => {
    try {
      await crud.create(toPayload(newRow));
      setAddingRow(false);
      setNewRow({ ...emptyFields });
    } catch { /* actionError set by hook */ }
  };

  const handleDelete = async (id: string | number) => {
    setBusyId(id);
    try {
      await crud.remove(id);
      setConfirmDeleteId(null);
    } catch { /* */ }
    finally { setBusyId(null); }
  };

  const handleRestore = async (id: string | number) => {
    try { await crud.restore(id); } catch { /* */ }
  };

  const handlePermanentDelete = async (id: string | number) => {
    setBusyId(id);
    try {
      await crud.permanentDelete(id);
      setConfirmPermanentId(null);
    } catch { /* */ }
    finally { setBusyId(null); }
  };

  const editInput = (field: string, type: string = "text", placeholder?: string) => (
    <input
      type={type}
      value={editValues[field] ?? ""}
      onChange={(e) => setEditValues({ ...editValues, [field]: e.target.value })}
      placeholder={placeholder ?? field}
      className={`w-full border border-border rounded px-2 py-1 text-sm bg-background ${type === "number" ? "font-mono text-right" : ""}`}
    />
  );

  const newInput = (field: string, type: string = "text", placeholder?: string) => (
    <input
      type={type}
      value={newRow[field] ?? ""}
      onChange={(e) => setNewRow({ ...newRow, [field]: e.target.value })}
      placeholder={placeholder ?? field}
      className={`border border-border rounded px-2 py-1 text-sm bg-background ${type === "number" ? "font-mono text-right" : ""}`}
    />
  );

  if (crud.error) return <ErrorState message={crud.error} />;
  if (!crud.items) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => crud.setShowDeleted(!crud.showDeleted)}
          className={crud.showDeleted ? "border-gray-400" : ""}
        >
          {crud.showDeleted ? "Hide Deleted" : "Show Deleted"}
        </Button>
        {writable && !addingRow && (
          <Button variant="outline" size="sm" onClick={() => { setAddingRow(true); crud.setActionError(null); }}>
            + Add {title}
          </Button>
        )}
      </div>

      {crud.actionError && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">{crud.actionError}</div>
      )}

      {addingRow && (
        <Card className="shadow-sm border-dashed">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">New {title}</div>
            {renderForm
              ? renderForm(newRow, (k, v) => setNewRow({ ...newRow, [k]: v }))
              : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.keys(emptyFields).map((field) => (
                    <div key={field}>{newInput(field, "text", field)}</div>
                  ))}
                </div>
              )}
            <div className="flex justify-end gap-1 mt-3">
              <Button variant="ghost" size="xs" onClick={handleAdd}>Save</Button>
              <Button variant="ghost" size="xs" onClick={() => { setAddingRow(false); crud.setActionError(null); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardContent className="pt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                {columns.map((col) => (
                  <th key={col.key} className={`${col.align === "right" ? "text-right" : "text-left"} font-medium pb-2`}>
                    {col.label}
                  </th>
                ))}
                {writable && <th className="text-right font-medium pb-2">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {crud.items
                .filter((item) => crud.showDeleted || !isDeleted(item))
                .map((item) => {
                  const id = getId(item);
                  const deleted = isDeleted(item);
                  const editing = editingId === id;
                  return (
                    <tr key={String(id)} className={`border-t border-border/50 ${deleted ? "opacity-50" : ""}`}>
                      {columns.map((col) => (
                        <td key={col.key} className={`py-1.5 ${col.align === "right" ? "text-right" : ""} ${col.mono ? "font-mono" : ""}`}>
                          {editing && col.editRender
                            ? col.editRender(editValues[col.key] ?? "", (v) => setEditValues({ ...editValues, [col.key]: v }))
                            : editing && editValues[col.key] !== undefined
                              ? editInput(col.key)
                              : col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? "")}
                        </td>
                      ))}
                      {writable && (
                        <td className="py-1.5 text-right">
                          {editing ? (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="xs" onClick={() => saveEdit(id)}>Save</Button>
                              <Button variant="ghost" size="xs" onClick={cancelEdit}>Cancel</Button>
                            </div>
                          ) : deleted ? (
                            <div className="flex justify-end gap-1 items-center">
                              <Button variant="ghost" size="xs" onClick={() => handleRestore(id)}>Restore</Button>
                              {confirmPermanentId === id ? (
                                <>
                                  <span className="text-xs text-red-600">Purge?</span>
                                  <Button variant="ghost" size="xs" className="text-red-600 hover:text-red-700" onClick={() => handlePermanentDelete(id)} disabled={busyId === id}>
                                    {busyId === id ? "..." : "Yes"}
                                  </Button>
                                  <Button variant="ghost" size="xs" onClick={() => setConfirmPermanentId(null)}>No</Button>
                                </>
                              ) : (
                                <Button variant="ghost" size="xs" className="text-red-600 hover:text-red-700" onClick={() => setConfirmPermanentId(id)}>Purge</Button>
                              )}
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1 items-center">
                              <Button variant="ghost" size="xs" onClick={() => startEdit(item)}>Edit</Button>
                              {confirmDeleteId === id ? (
                                <>
                                  <span className="text-xs text-red-600">Delete?</span>
                                  <Button variant="ghost" size="xs" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(id)} disabled={busyId === id}>
                                    {busyId === id ? "..." : "Yes"}
                                  </Button>
                                  <Button variant="ghost" size="xs" onClick={() => setConfirmDeleteId(null)}>No</Button>
                                </>
                              ) : (
                                <Button variant="ghost" size="xs" className="text-red-600 hover:text-red-700" onClick={() => setConfirmDeleteId(id)}>Delete</Button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
