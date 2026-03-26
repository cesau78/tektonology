"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/api-error";
import { useApiFetch } from "@/lib/api";
import { RequireRole } from "@/components/auth-guard";
import { useRole, canWrite } from "@/lib/auth";
import { JournalSelect } from "@/components/journal-select";
import { FormField, inputClass, monoInputClass } from "@/components/form-field";

interface HardwareData {
  hardwareId: number;
  supplier: string;
  supplierId: string | null;
  item: string;
  dimensions: string;
  material: string;
  effective: string;
  baseCost: number;
  taxes: number;
  shipping: number;
  cost: number;
  quantity: number;
  remaining: number;
  journalId?: number;
  deletedAt?: string;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function HardwarePage() {
  const [hardware, setHardware] = useState<HardwareData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({ item: "", supplier: "", supplierId: "", dimensions: "", material: "", effective: "", baseCost: "", taxes: "", shipping: "", cost: "", quantity: "", remaining: "", journalId: "" });
  const [addingRow, setAddingRow] = useState(false);
  const [newRow, setNewRow] = useState<Record<string, string>>({ item: "", supplier: "", supplierId: "", dimensions: "", material: "", effective: "", baseCost: "", taxes: "", shipping: "", cost: "", quantity: "", remaining: "", journalId: "" });
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
      supplierId: h.supplierId ?? "",
      dimensions: h.dimensions,
      material: h.material ?? "",
      effective: h.effective ?? "",
      baseCost: String(h.baseCost ?? 0),
      taxes: String(h.taxes ?? 0),
      shipping: String(h.shipping ?? 0),
      cost: String(h.cost),
      quantity: String(h.quantity),
      remaining: String(h.remaining),
      journalId: h.journalId ? String(h.journalId) : "",
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
          supplierId: editValues.supplierId?.trim() || null,
          dimensions: editValues.dimensions.trim(),
          material: (editValues.material || "").trim(),
          effective: editValues.effective,
          baseCost: parseFloat(editValues.baseCost) || 0,
          taxes: parseFloat(editValues.taxes) || 0,
          shipping: parseFloat(editValues.shipping) || 0,
          cost,
          quantity,
          remaining,
          ...(editValues.journalId ? { journalId: parseInt(editValues.journalId) } : {}),
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
          supplierId: newRow.supplierId?.trim() || null,
          dimensions: newRow.dimensions.trim(),
          material: (newRow.material || "").trim(),
          effective: newRow.effective,
          baseCost: parseFloat(newRow.baseCost) || 0,
          taxes: parseFloat(newRow.taxes) || 0,
          shipping: parseFloat(newRow.shipping) || 0,
          cost,
          quantity,
          remaining,
          ...(newRow.journalId ? { journalId: parseInt(newRow.journalId) } : {}),
        }),
      });
      setAddingRow(false);
      setNewRow({ item: "", supplier: "", supplierId: "", dimensions: "", material: "", effective: "", baseCost: "", taxes: "", shipping: "", cost: "", quantity: "", remaining: "", journalId: "" });
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to add");
    }
  };

  const renderHardwareForm = (values: Record<string, string>, setValues: (v: Record<string, string>) => void) => {
    const set = (k: string, v: string) => setValues({ ...values, [k]: v });
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <FormField label="Item">
          <input type="text" value={values.item} onChange={(e) => set("item", e.target.value)} placeholder="e.g. M3x20 Socket Cap Bolt" className={inputClass} autoFocus />
        </FormField>
        <FormField label="Supplier">
          <input type="text" value={values.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="e.g. Bolt Depot" className={inputClass} />
        </FormField>
        <FormField label="Supplier ID">
          <input type="text" value={values.supplierId} onChange={(e) => set("supplierId", e.target.value)} placeholder="Optional" className={inputClass} />
        </FormField>
        <FormField label="Dimensions">
          <input type="text" value={values.dimensions} onChange={(e) => set("dimensions", e.target.value)} placeholder="e.g. 3x0.5x20mm" className={monoInputClass} />
        </FormField>
        <FormField label="Material">
          <input type="text" value={values.material} onChange={(e) => set("material", e.target.value)} placeholder="e.g. Stainless steel" className={inputClass} />
        </FormField>
        <FormField label="Date Purchased">
          <input type="date" value={values.effective} onChange={(e) => set("effective", e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Base Cost">
          <input type="number" step="0.01" value={values.baseCost} onChange={(e) => set("baseCost", e.target.value)} placeholder="0.00" className={monoInputClass} />
        </FormField>
        <FormField label="Taxes">
          <input type="number" step="0.01" value={values.taxes} onChange={(e) => set("taxes", e.target.value)} placeholder="0.00" className={monoInputClass} />
        </FormField>
        <FormField label="Shipping">
          <input type="number" step="0.01" value={values.shipping} onChange={(e) => set("shipping", e.target.value)} placeholder="0.00" className={monoInputClass} />
        </FormField>
        <FormField label="Total Cost">
          <input type="number" step="0.01" value={values.cost} onChange={(e) => set("cost", e.target.value)} placeholder="0.00" className={monoInputClass} />
        </FormField>
        <FormField label="Quantity">
          <input type="number" value={values.quantity} onChange={(e) => set("quantity", e.target.value)} placeholder="0" className={monoInputClass} />
        </FormField>
        <FormField label="Remaining">
          <input type="number" value={values.remaining} onChange={(e) => set("remaining", e.target.value)} placeholder="0" className={monoInputClass} />
        </FormField>
        <FormField label="Journal Entry" className="col-span-2 md:col-span-3">
          <JournalSelect value={values.journalId} onChange={(v) => set("journalId", v)} />
        </FormField>
      </div>
    );
  };

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

      {addingRow && (
        <Card className="shadow-sm border-dashed mb-4">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">New Hardware</div>
            {renderHardwareForm(newRow, setNewRow)}
            <div className="flex justify-end gap-1 mt-3">
              <Button variant="ghost" size="xs" onClick={addHardware}>Save</Button>
              <Button variant="ghost" size="xs" onClick={() => { setAddingRow(false); setActionError(null); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {editingRow != null && (
        <Card className="shadow-sm border-amber-300 mb-4">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Edit Hardware #{editingRow}</div>
            {renderHardwareForm(editValues, setEditValues)}
            <div className="flex justify-end gap-1 mt-3">
              <Button variant="ghost" size="xs" onClick={() => saveEdit(editingRow)}>Save</Button>
              <Button variant="ghost" size="xs" onClick={cancelEdit}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
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
                  <th className="text-right font-medium pb-2">Journal</th>
                  {writable && <th className="text-right font-medium pb-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {hardware.map((h) => {
                  const isDeleted = !!h.deletedAt;
                  const unitCost = h.quantity > 0 ? h.cost / h.quantity : 0;
                  return (
                    <tr key={h.hardwareId} className={`border-t border-border/50 hover:bg-muted/20 transition-colors ${isDeleted ? "opacity-50" : ""}`}>
                      <td className="py-1.5 font-mono text-xs text-muted-foreground">{h.hardwareId}</td>
                      <td className="py-1.5"><span className="font-medium">{h.item}</span></td>
                      <td className="py-1.5 text-muted-foreground">{h.supplier}</td>
                      <td className="py-1.5 font-mono text-xs">{h.dimensions}</td>
                      <td className="py-1.5 text-right font-mono">{fmt(h.cost)}</td>
                      <td className="py-1.5 text-right font-mono text-xs">{fmt(unitCost)}</td>
                      <td className="py-1.5 text-right font-mono">{h.quantity.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono">{h.remaining.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono text-xs">{h.journalId ? `#${h.journalId}` : "—"}</td>
                      {writable && (
                        <td className="py-1.5 text-right">
                          {isDeleted ? (
                            <div className="flex justify-end gap-1 items-center">
                              <Button variant="ghost" size="xs" onClick={() => handleRestore(h.hardwareId)}>Restore</Button>
                              {confirmPermanentDeleteId === h.hardwareId ? (
                                <>
                                  <span className="text-xs text-red-600">Purge?</span>
                                  <Button variant="ghost" size="xs" className="text-red-600 hover:text-red-700" onClick={() => handlePermanentDelete(h.hardwareId)} disabled={deletingId === h.hardwareId}>
                                    {deletingId === h.hardwareId ? "..." : "Yes"}
                                  </Button>
                                  <Button variant="ghost" size="xs" onClick={() => setConfirmPermanentDeleteId(null)}>No</Button>
                                </>
                              ) : (
                                <Button variant="ghost" size="xs" className="text-red-600 hover:text-red-700" onClick={() => setConfirmPermanentDeleteId(h.hardwareId)}>Purge</Button>
                              )}
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1 items-center">
                              <Button variant="ghost" size="xs" onClick={() => startEdit(h)}>Edit</Button>
                              {confirmDeleteId === h.hardwareId ? (
                                <>
                                  <span className="text-xs text-red-600">Delete?</span>
                                  <Button variant="ghost" size="xs" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(h.hardwareId)} disabled={deletingId === h.hardwareId}>
                                    {deletingId === h.hardwareId ? "..." : "Yes"}
                                  </Button>
                                  <Button variant="ghost" size="xs" onClick={() => setConfirmDeleteId(null)}>No</Button>
                                </>
                              ) : (
                                <Button variant="ghost" size="xs" className="text-red-600 hover:text-red-700" onClick={() => setConfirmDeleteId(h.hardwareId)}>Delete</Button>
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
