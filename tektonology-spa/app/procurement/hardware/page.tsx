"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/api-error";
import { useApiFetch } from "@/lib/api";
import { RequireRole } from "@/components/auth-guard";
import { useRole, canWrite } from "@/lib/auth";

interface HardwareData {
  hardwareId: number;
  supplier: string;
  item: string;
  dimensions: string;
  cost: number;
  quantity: number;
  remaining: number;
  deletedAt?: string;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function HardwarePage() {
  const [hardware, setHardware] = useState<HardwareData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ item: string; supplier: string; dimensions: string; cost: string; quantity: string; remaining: string }>({ item: "", supplier: "", dimensions: "", cost: "", quantity: "", remaining: "" });
  const [addingRow, setAddingRow] = useState(false);
  const [newRow, setNewRow] = useState({ item: "", supplier: "", dimensions: "", cost: "", quantity: "", remaining: "" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmPermanentDeleteId, setConfirmPermanentDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { role } = useRole();
  const apiFetch = useApiFetch();
  const writable = canWrite(role);

  const load = useCallback(() => {
    apiFetch<HardwareData[]>(`/api/procurement/hardware${showDeleted ? "?includeDeleted=true" : ""}`)
      .then(setHardware)
      .catch((e) => setError(e.message));
  }, [apiFetch, showDeleted]);

  useEffect(() => { load(); }, [load]);

  const active = hardware?.filter((h) => !h.deletedAt) ?? [];
  const totalCost = active.reduce((s, h) => s + h.cost, 0);
  const totalPieces = active.reduce((s, h) => s + h.remaining, 0);

  const startEdit = (h: HardwareData) => {
    setEditingRow(h.hardwareId);
    setEditValues({
      item: h.item,
      supplier: h.supplier,
      dimensions: h.dimensions,
      cost: String(h.cost),
      quantity: String(h.quantity),
      remaining: String(h.remaining),
    });
    setActionError(null);
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setActionError(null);
  };

  const saveEdit = async (hardwareId: number) => {
    setActionError(null);
    if (!editValues.item.trim()) {
      setActionError("Item name is required");
      return;
    }
    if (!editValues.supplier.trim()) {
      setActionError("Supplier is required");
      return;
    }
    const cost = parseFloat(editValues.cost);
    const quantity = parseInt(editValues.quantity, 10);
    const remaining = parseInt(editValues.remaining, 10);
    if (Number.isNaN(cost) || cost < 0) {
      setActionError("Cost must be a non-negative number");
      return;
    }
    if (Number.isNaN(quantity) || quantity < 0) {
      setActionError("Quantity must be a non-negative integer");
      return;
    }
    if (Number.isNaN(remaining) || remaining < 0) {
      setActionError("Remaining must be a non-negative integer");
      return;
    }
    try {
      await apiFetch(`/api/procurement/hardware/${hardwareId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: editValues.item.trim(),
          supplier: editValues.supplier.trim(),
          dimensions: editValues.dimensions.trim(),
          cost,
          quantity,
          remaining,
        }),
      });
      setEditingRow(null);
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const handleDelete = async (hardwareId: number) => {
    setDeletingId(hardwareId);
    setActionError(null);
    try {
      await apiFetch(`/api/procurement/hardware/${hardwareId}`, { method: "DELETE" });
      setConfirmDeleteId(null);
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestore = async (hardwareId: number) => {
    setActionError(null);
    try {
      await apiFetch(`/api/procurement/hardware/${hardwareId}/restore`, { method: "POST" });
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to restore");
    }
  };

  const handlePermanentDelete = async (hardwareId: number) => {
    setDeletingId(hardwareId);
    setActionError(null);
    try {
      await apiFetch(`/api/procurement/hardware/${hardwareId}/permanent`, { method: "DELETE" });
      setConfirmPermanentDeleteId(null);
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to permanently delete");
    } finally {
      setDeletingId(null);
    }
  };

  const addHardware = async () => {
    setActionError(null);
    if (!newRow.item.trim()) {
      setActionError("Item name is required");
      return;
    }
    if (!newRow.supplier.trim()) {
      setActionError("Supplier is required");
      return;
    }
    const cost = parseFloat(newRow.cost);
    const quantity = parseInt(newRow.quantity, 10);
    const remaining = parseInt(newRow.remaining, 10);
    if (Number.isNaN(cost) || cost < 0) {
      setActionError("Cost must be a non-negative number");
      return;
    }
    if (Number.isNaN(quantity) || quantity < 0) {
      setActionError("Quantity must be a non-negative integer");
      return;
    }
    if (Number.isNaN(remaining) || remaining < 0) {
      setActionError("Remaining must be a non-negative integer");
      return;
    }
    try {
      await apiFetch("/api/procurement/hardware", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: newRow.item.trim(),
          supplier: newRow.supplier.trim(),
          dimensions: newRow.dimensions.trim(),
          cost,
          quantity,
          remaining,
        }),
      });
      setAddingRow(false);
      setNewRow({ item: "", supplier: "", dimensions: "", cost: "", quantity: "", remaining: "" });
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to add");
    }
  };

  const inputClass = "w-full border border-border rounded px-2 py-1 text-sm bg-background";

  return (
    <RequireRole roles={["owner", "auditor"]}>
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>›</span>
        <Link href="/procurement" className="hover:text-foreground transition-colors">Procurement</Link>
        <span>›</span>
        <span className="text-foreground">Hardware Inventory</span>
      </nav>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Hardware Inventory</h1>
          {hardware && (
            <p className="text-muted-foreground text-sm">
              {totalPieces.toLocaleString()} pieces on hand — {fmt(totalCost)} invested
              {showDeleted && hardware.some((h) => h.deletedAt) && (
                <span className="text-gray-400"> ({hardware.filter((h) => h.deletedAt).length} deleted)</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleted((v) => !v)}
            className={showDeleted ? "border-gray-400" : ""}
          >
            {showDeleted ? "Hide Deleted" : "Show Deleted"}
          </Button>
          {writable && !addingRow && (
            <Button variant="outline" size="sm" onClick={() => { setAddingRow(true); setActionError(null); }}>
              + Add Hardware
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorState message={error} />}
      {!hardware && !error && <LoadingState />}

      {actionError && (
        <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">{actionError}</div>
      )}

      {hardware && (
        <Card className="shadow-sm">
          <CardContent className="pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left font-medium pb-2">#</th>
                  <th className="text-left font-medium pb-2">Item</th>
                  <th className="text-left font-medium pb-2">Supplier</th>
                  <th className="text-left font-medium pb-2">Dimensions</th>
                  <th className="text-right font-medium pb-2">Cost</th>
                  <th className="text-right font-medium pb-2">Unit</th>
                  <th className="text-right font-medium pb-2">Qty</th>
                  <th className="text-right font-medium pb-2">Remaining</th>
                  {writable && <th className="text-right font-medium pb-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {addingRow && (
                  <tr className="border-t border-border bg-muted/30">
                    <td className="py-2 pr-2 font-mono text-xs text-muted-foreground">--</td>
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={newRow.item}
                        onChange={(e) => setNewRow({ ...newRow, item: e.target.value })}
                        placeholder="Item name"
                        className={inputClass}
                        autoFocus
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={newRow.supplier}
                        onChange={(e) => setNewRow({ ...newRow, supplier: e.target.value })}
                        placeholder="Supplier"
                        className={inputClass}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={newRow.dimensions}
                        onChange={(e) => setNewRow({ ...newRow, dimensions: e.target.value })}
                        placeholder="Dimensions"
                        className={`${inputClass} font-mono`}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        step="0.01"
                        value={newRow.cost}
                        onChange={(e) => setNewRow({ ...newRow, cost: e.target.value })}
                        placeholder="0.00"
                        className={`${inputClass} text-right font-mono`}
                      />
                    </td>
                    <td className="py-2 text-right font-mono text-muted-foreground">--</td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        value={newRow.quantity}
                        onChange={(e) => setNewRow({ ...newRow, quantity: e.target.value })}
                        placeholder="0"
                        className={`${inputClass} text-right font-mono`}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        value={newRow.remaining}
                        onChange={(e) => setNewRow({ ...newRow, remaining: e.target.value })}
                        placeholder="0"
                        className={`${inputClass} text-right font-mono`}
                      />
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="xs" onClick={addHardware}>Save</Button>
                        <Button variant="ghost" size="xs" onClick={() => { setAddingRow(false); setActionError(null); }}>Cancel</Button>
                      </div>
                    </td>
                  </tr>
                )}
                {hardware.map((h) => {
                  const isDeleted = !!h.deletedAt;
                  const unitCost = h.quantity > 0 ? h.cost / h.quantity : 0;
                  return (
                    <tr key={h.hardwareId} className={`border-t border-border/50 hover:bg-muted/20 transition-colors ${isDeleted ? "opacity-50" : ""}`}>
                      <td className="py-1.5 font-mono text-xs text-muted-foreground">{h.hardwareId}</td>
                      <td className="py-1.5">
                        {editingRow === h.hardwareId ? (
                          <input
                            type="text"
                            value={editValues.item}
                            onChange={(e) => setEditValues({ ...editValues, item: e.target.value })}
                            className={inputClass}
                            autoFocus
                          />
                        ) : (
                          <span className="font-medium">{h.item}</span>
                        )}
                      </td>
                      <td className="py-1.5">
                        {editingRow === h.hardwareId ? (
                          <input
                            type="text"
                            value={editValues.supplier}
                            onChange={(e) => setEditValues({ ...editValues, supplier: e.target.value })}
                            className={inputClass}
                          />
                        ) : (
                          <span className="text-muted-foreground">{h.supplier}</span>
                        )}
                      </td>
                      <td className="py-1.5">
                        {editingRow === h.hardwareId ? (
                          <input
                            type="text"
                            value={editValues.dimensions}
                            onChange={(e) => setEditValues({ ...editValues, dimensions: e.target.value })}
                            className={`${inputClass} font-mono`}
                          />
                        ) : (
                          <span className="font-mono text-xs">{h.dimensions}</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right">
                        {editingRow === h.hardwareId ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editValues.cost}
                            onChange={(e) => setEditValues({ ...editValues, cost: e.target.value })}
                            className={`${inputClass} text-right font-mono`}
                          />
                        ) : (
                          <span className="font-mono">{fmt(h.cost)}</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right font-mono text-xs">{fmt(unitCost)}</td>
                      <td className="py-1.5 text-right">
                        {editingRow === h.hardwareId ? (
                          <input
                            type="number"
                            value={editValues.quantity}
                            onChange={(e) => setEditValues({ ...editValues, quantity: e.target.value })}
                            className={`${inputClass} text-right font-mono`}
                          />
                        ) : (
                          <span className="font-mono">{h.quantity.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right">
                        {editingRow === h.hardwareId ? (
                          <input
                            type="number"
                            value={editValues.remaining}
                            onChange={(e) => setEditValues({ ...editValues, remaining: e.target.value })}
                            className={`${inputClass} text-right font-mono`}
                          />
                        ) : (
                          <span className="font-mono">{h.remaining.toLocaleString()}</span>
                        )}
                      </td>
                      {writable && (
                        <td className="py-1.5 text-right">
                          {editingRow === h.hardwareId ? (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="xs" onClick={() => saveEdit(h.hardwareId)}>Save</Button>
                              <Button variant="ghost" size="xs" onClick={cancelEdit}>Cancel</Button>
                            </div>
                          ) : isDeleted ? (
                            <div className="flex justify-end gap-1 items-center">
                              <Button variant="ghost" size="xs" onClick={() => handleRestore(h.hardwareId)}>Restore</Button>
                              {confirmPermanentDeleteId === h.hardwareId ? (
                                <>
                                  <span className="text-xs text-red-600">Purge?</span>
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => handlePermanentDelete(h.hardwareId)}
                                    disabled={deletingId === h.hardwareId}
                                  >
                                    {deletingId === h.hardwareId ? "..." : "Yes"}
                                  </Button>
                                  <Button variant="ghost" size="xs" onClick={() => setConfirmPermanentDeleteId(null)}>No</Button>
                                </>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => setConfirmPermanentDeleteId(h.hardwareId)}
                                >
                                  Purge
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1 items-center">
                              <Button variant="ghost" size="xs" onClick={() => startEdit(h)}>Edit</Button>
                              {confirmDeleteId === h.hardwareId ? (
                                <>
                                  <span className="text-xs text-red-600">Delete?</span>
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => handleDelete(h.hardwareId)}
                                    disabled={deletingId === h.hardwareId}
                                  >
                                    {deletingId === h.hardwareId ? "..." : "Yes"}
                                  </Button>
                                  <Button variant="ghost" size="xs" onClick={() => setConfirmDeleteId(null)}>No</Button>
                                </>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => setConfirmDeleteId(h.hardwareId)}
                                >
                                  Delete
                                </Button>
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
      )}
    </div>
    </RequireRole>
  );
}
