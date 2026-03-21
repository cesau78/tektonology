"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/api-error";
import { useApiFetch } from "@/lib/api";
import { RequireRole } from "@/components/auth-guard";
import { useRole, canWrite } from "@/lib/auth";

interface SpoolData {
  spoolId: number;
  brand: string;
  material: string;
  color: string;
  cost: number;
  weightG: number;
  remainingG: number;
  deletedAt?: string;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const materialColor: Record<string, string> = {
  "TPU 90A": "bg-violet-100 text-violet-900 border-violet-300",
  "PLA Pro": "bg-amber-100 text-amber-900 border-amber-300",
  PETG: "bg-sky-100 text-sky-900 border-sky-300",
};

export default function SpoolsPage() {
  const [spools, setSpools] = useState<SpoolData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ brand: string; material: string; color: string; cost: string; weightG: string; remainingG: string }>({ brand: "", material: "", color: "", cost: "", weightG: "", remainingG: "" });
  const [addingRow, setAddingRow] = useState(false);
  const [newRow, setNewRow] = useState({ brand: "", material: "", color: "", cost: "", weightG: "", remainingG: "" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmPermanentDeleteId, setConfirmPermanentDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { role } = useRole();
  const apiFetch = useApiFetch();
  const writable = canWrite(role);

  const load = useCallback(() => {
    apiFetch<SpoolData[]>(`/api/procurement/spools${showDeleted ? "?includeDeleted=true" : ""}`)
      .then(setSpools)
      .catch((e) => setError(e.message));
  }, [apiFetch, showDeleted]);

  useEffect(() => { load(); }, [load]);

  // Aggregations only count non-deleted spools
  const activeSpools = spools?.filter((s) => !s.deletedAt) ?? [];
  const totalRemaining = activeSpools.reduce((s, sp) => s + sp.remainingG, 0);
  const totalWeight = activeSpools.reduce((s, sp) => s + sp.weightG, 0);
  const totalCost = activeSpools.reduce((s, sp) => s + sp.cost, 0);

  // Group by material
  const byMaterial = new Map<string, SpoolData[]>();
  for (const s of spools ?? []) {
    const list = byMaterial.get(s.material) ?? [];
    list.push(s);
    byMaterial.set(s.material, list);
  }

  const startEdit = (spool: SpoolData) => {
    setEditingRow(spool.spoolId);
    setEditValues({
      brand: spool.brand,
      material: spool.material,
      color: spool.color,
      cost: String(spool.cost),
      weightG: String(spool.weightG),
      remainingG: String(spool.remainingG),
    });
    setActionError(null);
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setActionError(null);
  };

  const saveEdit = async (spoolId: number) => {
    setActionError(null);
    const cost = parseFloat(editValues.cost);
    const weightG = parseFloat(editValues.weightG);
    const remainingG = parseFloat(editValues.remainingG);
    if (!editValues.brand.trim()) { setActionError("Brand is required"); return; }
    if (!editValues.material.trim()) { setActionError("Material is required"); return; }
    if (!editValues.color.trim()) { setActionError("Color is required"); return; }
    if (Number.isNaN(cost) || cost < 0) { setActionError("Cost must be a non-negative number"); return; }
    if (Number.isNaN(weightG) || weightG <= 0) { setActionError("Weight must be a positive number"); return; }
    if (Number.isNaN(remainingG) || remainingG < 0) { setActionError("Remaining must be a non-negative number"); return; }
    try {
      await apiFetch(`/api/procurement/spools/${spoolId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: editValues.brand.trim(),
          material: editValues.material.trim(),
          color: editValues.color.trim(),
          cost,
          weightG,
          remainingG,
        }),
      });
      setEditingRow(null);
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const handleDelete = async (spoolId: number) => {
    setDeletingId(spoolId);
    setActionError(null);
    try {
      await apiFetch(`/api/procurement/spools/${spoolId}`, { method: "DELETE" });
      setConfirmDeleteId(null);
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestore = async (spoolId: number) => {
    setActionError(null);
    try {
      await apiFetch(`/api/procurement/spools/${spoolId}/restore`, { method: "POST" });
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to restore");
    }
  };

  const handlePermanentDelete = async (spoolId: number) => {
    setDeletingId(spoolId);
    setActionError(null);
    try {
      await apiFetch(`/api/procurement/spools/${spoolId}/permanent`, { method: "DELETE" });
      setConfirmPermanentDeleteId(null);
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to permanently delete");
    } finally {
      setDeletingId(null);
    }
  };

  const addSpool = async () => {
    setActionError(null);
    const cost = parseFloat(newRow.cost);
    const weightG = parseFloat(newRow.weightG);
    const remainingG = parseFloat(newRow.remainingG);
    if (!newRow.brand.trim()) { setActionError("Brand is required"); return; }
    if (!newRow.material.trim()) { setActionError("Material is required"); return; }
    if (!newRow.color.trim()) { setActionError("Color is required"); return; }
    if (Number.isNaN(cost) || cost < 0) { setActionError("Cost must be a non-negative number"); return; }
    if (Number.isNaN(weightG) || weightG <= 0) { setActionError("Weight must be a positive number"); return; }
    if (Number.isNaN(remainingG) || remainingG < 0) { setActionError("Remaining must be a non-negative number"); return; }
    try {
      await apiFetch("/api/procurement/spools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: newRow.brand.trim(),
          material: newRow.material.trim(),
          color: newRow.color.trim(),
          cost,
          weightG,
          remainingG,
        }),
      });
      setAddingRow(false);
      setNewRow({ brand: "", material: "", color: "", cost: "", weightG: "", remainingG: "" });
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to add");
    }
  };

  return (
    <RequireRole roles={["owner", "auditor"]}>
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>›</span>
        <Link href="/procurement" className="hover:text-foreground transition-colors">Procurement</Link>
        <span>›</span>
        <span className="text-foreground">Filament Spools</span>
      </nav>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Filament Spools</h1>
          {spools && (
            <p className="text-muted-foreground text-sm">
              {activeSpools.length} spools — {(totalRemaining / 1000).toFixed(1)} kg remaining of {(totalWeight / 1000).toFixed(1)} kg purchased ({fmt(totalCost)} invested)
              {showDeleted && spools.some((s) => s.deletedAt) && (
                <span className="text-gray-400"> ({spools.filter((s) => s.deletedAt).length} deleted)</span>
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
              + Add Spool
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorState message={error} />}
      {!spools && !error && <LoadingState />}

      {actionError && (
        <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">{actionError}</div>
      )}

      {spools && (
        <div className="space-y-6">
          {addingRow && (
            <Card className="shadow-sm border-dashed">
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">New Spool</div>
                <div className="grid grid-cols-6 gap-2 mb-2">
                  <input
                    type="text"
                    value={newRow.brand}
                    onChange={(e) => setNewRow({ ...newRow, brand: e.target.value })}
                    placeholder="Brand"
                    className="border border-border rounded px-2 py-1 text-sm bg-background"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={newRow.material}
                    onChange={(e) => setNewRow({ ...newRow, material: e.target.value })}
                    placeholder="Material"
                    className="border border-border rounded px-2 py-1 text-sm bg-background"
                  />
                  <input
                    type="text"
                    value={newRow.color}
                    onChange={(e) => setNewRow({ ...newRow, color: e.target.value })}
                    placeholder="Color"
                    className="border border-border rounded px-2 py-1 text-sm bg-background"
                  />
                  <input
                    type="number"
                    value={newRow.cost}
                    onChange={(e) => setNewRow({ ...newRow, cost: e.target.value })}
                    placeholder="Cost"
                    className="border border-border rounded px-2 py-1 text-sm bg-background font-mono"
                  />
                  <input
                    type="number"
                    value={newRow.weightG}
                    onChange={(e) => setNewRow({ ...newRow, weightG: e.target.value })}
                    placeholder="Weight (g)"
                    className="border border-border rounded px-2 py-1 text-sm bg-background font-mono"
                  />
                  <input
                    type="number"
                    value={newRow.remainingG}
                    onChange={(e) => setNewRow({ ...newRow, remainingG: e.target.value })}
                    placeholder="Remaining (g)"
                    className="border border-border rounded px-2 py-1 text-sm bg-background font-mono"
                  />
                </div>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="xs" onClick={addSpool}>Save</Button>
                  <Button variant="ghost" size="xs" onClick={() => { setAddingRow(false); setActionError(null); }}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {Array.from(byMaterial.entries())
            .filter(([, items]) => {
              // When showDeleted is false, hide groups that only have deleted spools
              if (!showDeleted) return items.some((s) => !s.deletedAt);
              return true;
            })
            .map(([material, items]) => {
              // Aggregations only count non-deleted spools
              const activeItems = items.filter((s) => !s.deletedAt);
              const groupRemaining = activeItems.reduce((s, sp) => s + sp.remainingG, 0);
              const groupTotal = activeItems.reduce((s, sp) => s + sp.weightG, 0);
              const groupCost = activeItems.reduce((s, sp) => s + sp.cost, 0);

              // Filter out deleted spools from display when showDeleted is false
              const visibleItems = showDeleted ? items : items.filter((s) => !s.deletedAt);

              return (
                <div key={material}>
                  <div className="flex items-center gap-3 mb-3">
                    <Badge className={`${materialColor[material] ?? "bg-gray-100 text-gray-900 border-gray-300"} hover:bg-opacity-100`}>
                      {material}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {(groupRemaining / 1000).toFixed(1)} / {(groupTotal / 1000).toFixed(1)} kg — {fmt(groupCost)}
                    </span>
                    <div className="flex-1 border-t border-border" />
                  </div>

                  <Card className="shadow-sm">
                    <CardContent className="pt-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                            <th className="text-left font-medium pb-2">#</th>
                            <th className="text-left font-medium pb-2">Brand</th>
                            <th className="text-left font-medium pb-2">Color</th>
                            <th className="text-right font-medium pb-2">Cost</th>
                            <th className="text-right font-medium pb-2">$/g</th>
                            <th className="text-right font-medium pb-2">Remaining</th>
                            <th className="text-right font-medium pb-2">%</th>
                            {writable && <th className="text-right font-medium pb-2">Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {visibleItems.map((s) => {
                            const isDeleted = !!s.deletedAt;
                            const pct = s.weightG > 0 ? (s.remainingG / s.weightG) * 100 : 0;
                            const costPerG = s.weightG > 0 ? s.cost / s.weightG : 0;
                            return (
                              <tr key={s.spoolId} className={`border-t border-border/50 ${isDeleted ? "opacity-50" : ""}`}>
                                <td className="py-1.5 font-mono text-xs text-muted-foreground">{s.spoolId}</td>
                                <td className="py-1.5">
                                  {editingRow === s.spoolId ? (
                                    <input
                                      type="text"
                                      value={editValues.brand}
                                      onChange={(e) => setEditValues({ ...editValues, brand: e.target.value })}
                                      className="w-full border border-border rounded px-2 py-1 text-sm bg-background"
                                      autoFocus
                                    />
                                  ) : (
                                    s.brand
                                  )}
                                </td>
                                <td className="py-1.5">
                                  {editingRow === s.spoolId ? (
                                    <input
                                      type="text"
                                      value={editValues.color}
                                      onChange={(e) => setEditValues({ ...editValues, color: e.target.value })}
                                      className="w-full border border-border rounded px-2 py-1 text-sm bg-background"
                                    />
                                  ) : (
                                    s.color
                                  )}
                                </td>
                                <td className="py-1.5 text-right font-mono">
                                  {editingRow === s.spoolId ? (
                                    <input
                                      type="number"
                                      value={editValues.cost}
                                      onChange={(e) => setEditValues({ ...editValues, cost: e.target.value })}
                                      className="w-20 border border-border rounded px-2 py-1 text-sm bg-background font-mono text-right"
                                    />
                                  ) : (
                                    fmt(s.cost)
                                  )}
                                </td>
                                <td className="py-1.5 text-right font-mono text-xs">{costPerG.toFixed(3)}</td>
                                <td className="py-1.5 text-right font-mono">
                                  {editingRow === s.spoolId ? (
                                    <input
                                      type="number"
                                      value={editValues.remainingG}
                                      onChange={(e) => setEditValues({ ...editValues, remainingG: e.target.value })}
                                      className="w-20 border border-border rounded px-2 py-1 text-sm bg-background font-mono text-right"
                                    />
                                  ) : (
                                    `${s.remainingG.toFixed(0)}g`
                                  )}
                                </td>
                                <td className="py-1.5 text-right">
                                  <div className="inline-flex items-center gap-1.5">
                                    <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-red-500"}`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-mono text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
                                  </div>
                                </td>
                                {writable && (
                                  <td className="py-1.5 text-right">
                                    {editingRow === s.spoolId ? (
                                      <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="xs" onClick={() => saveEdit(s.spoolId)}>Save</Button>
                                        <Button variant="ghost" size="xs" onClick={cancelEdit}>Cancel</Button>
                                      </div>
                                    ) : isDeleted ? (
                                      <div className="flex justify-end gap-1 items-center">
                                        <Button variant="ghost" size="xs" onClick={() => handleRestore(s.spoolId)}>Restore</Button>
                                        {confirmPermanentDeleteId === s.spoolId ? (
                                          <>
                                            <span className="text-xs text-red-600">Purge?</span>
                                            <Button
                                              variant="ghost"
                                              size="xs"
                                              className="text-red-600 hover:text-red-700"
                                              onClick={() => handlePermanentDelete(s.spoolId)}
                                              disabled={deletingId === s.spoolId}
                                            >
                                              {deletingId === s.spoolId ? "..." : "Yes"}
                                            </Button>
                                            <Button variant="ghost" size="xs" onClick={() => setConfirmPermanentDeleteId(null)}>No</Button>
                                          </>
                                        ) : (
                                          <Button
                                            variant="ghost"
                                            size="xs"
                                            className="text-red-600 hover:text-red-700"
                                            onClick={() => setConfirmPermanentDeleteId(s.spoolId)}
                                          >
                                            Purge
                                          </Button>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex justify-end gap-1 items-center">
                                        <Button variant="ghost" size="xs" onClick={() => startEdit(s)}>Edit</Button>
                                        {confirmDeleteId === s.spoolId ? (
                                          <>
                                            <span className="text-xs text-red-600">Delete?</span>
                                            <Button
                                              variant="ghost"
                                              size="xs"
                                              className="text-red-600 hover:text-red-700"
                                              onClick={() => handleDelete(s.spoolId)}
                                              disabled={deletingId === s.spoolId}
                                            >
                                              {deletingId === s.spoolId ? "..." : "Yes"}
                                            </Button>
                                            <Button variant="ghost" size="xs" onClick={() => setConfirmDeleteId(null)}>No</Button>
                                          </>
                                        ) : (
                                          <Button
                                            variant="ghost"
                                            size="xs"
                                            className="text-red-600 hover:text-red-700"
                                            onClick={() => setConfirmDeleteId(s.spoolId)}
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
                </div>
              );
            })}
        </div>
      )}
    </div>
    </RequireRole>
  );
}
