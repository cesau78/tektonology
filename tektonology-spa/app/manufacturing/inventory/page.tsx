"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/api-error";
import { RequireRole } from "@/components/auth-guard";
import { useRole, canWrite } from "@/lib/auth";
import { useApiFetch } from "@/lib/api";
import { useCrud } from "@/lib/use-crud";
import { FormField, inputClass, monoInputClass } from "@/components/form-field";

interface InventoryComponent {
  batchId: number;
  part: string;
  quantity: number;
}

interface InventoryHardware {
  hardwareId: number;
  item: string;
  quantity: number;
}

interface InventoryData {
  inventoryId: number;
  product: string;
  effective: string;
  components: InventoryComponent[];
  hardware?: InventoryHardware[];
  quantity: number;
  remaining: number;
  deletedAt?: string;
}

interface ComponentStockOption {
  batchId: number;
  part: string;
  remaining: number;
}

interface HardwareOption {
  hardwareId: number;
  item: string;
  remaining: number;
}

const emptyComponent = { batchId: "", part: "", quantity: "" };
const emptyHardware = { hardwareId: "", item: "", quantity: "" };

export default function InventoryPage() {
  const crud = useCrud<InventoryData>("/api/inventory");
  const { role } = useRole();
  const writable = canWrite(role);
  const apiFetch = useApiFetch();

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addingRow, setAddingRow] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmPermanentId, setConfirmPermanentId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Dropdown options
  const [componentOptions, setComponentOptions] = useState<ComponentStockOption[]>([]);
  const [hardwareOptions, setHardwareOptions] = useState<HardwareOption[]>([]);

  useEffect(() => {
    apiFetch<ComponentStockOption[]>("/api/manufacturing/components")
      .then(setComponentOptions)
      .catch(() => setComponentOptions([]));
    apiFetch<HardwareOption[]>("/api/procurement/hardware")
      .then(setHardwareOptions)
      .catch(() => setHardwareOptions([]));
  }, [apiFetch]);

  // Form state
  const [formProduct, setFormProduct] = useState("");
  const [formEffective, setFormEffective] = useState("");
  const [formQuantity, setFormQuantity] = useState("");
  const [formRemaining, setFormRemaining] = useState("");
  const [formComponents, setFormComponents] = useState<{ batchId: string; part: string; quantity: string }[]>([{ ...emptyComponent }]);
  const [formHardware, setFormHardware] = useState<{ hardwareId: string; item: string; quantity: string }[]>([]);

  const resetForm = () => {
    setFormProduct("");
    setFormEffective("");
    setFormQuantity("");
    setFormRemaining("");
    setFormComponents([{ ...emptyComponent }]);
    setFormHardware([]);
  };

  const startAdd = () => {
    resetForm();
    setAddingRow(true);
    setEditingId(null);
    crud.setActionError(null);
  };

  const startEdit = (item: InventoryData) => {
    setFormProduct(item.product);
    setFormEffective(item.effective);
    setFormQuantity(String(item.quantity));
    setFormRemaining(String(item.remaining));
    setFormComponents(
      item.components.length > 0
        ? item.components.map((c) => ({ batchId: String(c.batchId), part: c.part, quantity: String(c.quantity) }))
        : [{ ...emptyComponent }],
    );
    setFormHardware(
      (item.hardware ?? []).map((h) => ({ hardwareId: String(h.hardwareId), item: h.item, quantity: String(h.quantity) })),
    );
    setEditingId(item.inventoryId);
    setAddingRow(false);
    crud.setActionError(null);
  };

  const buildPayload = () => ({
    product: formProduct.trim(),
    effective: formEffective,
    components: formComponents
      .filter((c) => c.batchId)
      .map((c) => ({ batchId: Number(c.batchId), part: c.part.trim(), quantity: Number(c.quantity) })),
    hardware: formHardware
      .filter((h) => h.hardwareId)
      .map((h) => ({ hardwareId: Number(h.hardwareId), item: h.item.trim(), quantity: Number(h.quantity) })),
    quantity: Number(formQuantity),
    remaining: Number(formRemaining),
  });

  const handleAdd = async () => {
    try {
      await crud.create(buildPayload() as Partial<InventoryData>);
      setAddingRow(false);
      resetForm();
    } catch { /* error set by hook */ }
  };

  const handleSaveEdit = async () => {
    try {
      await crud.update(editingId!, buildPayload() as Partial<InventoryData>);
      setEditingId(null);
      resetForm();
    } catch { /* error set by hook */ }
  };

  const handleDelete = async (id: number) => {
    setBusyId(id);
    try { await crud.remove(id); setConfirmDeleteId(null); } catch { /* */ }
    finally { setBusyId(null); }
  };

  const handleRestore = async (id: number) => {
    try { await crud.restore(id); } catch { /* */ }
  };

  const handlePermanentDelete = async (id: number) => {
    setBusyId(id);
    try { await crud.permanentDelete(id); setConfirmPermanentId(null); } catch { /* */ }
    finally { setBusyId(null); }
  };

  const updateComponent = (idx: number, field: string, value: string) => {
    const updated = [...formComponents];
    updated[idx] = { ...updated[idx], [field]: value };
    setFormComponents(updated);
  };

  const updateHw = (idx: number, field: string, value: string) => {
    const updated = [...formHardware];
    updated[idx] = { ...updated[idx], [field]: value };
    setFormHardware(updated);
  };

  const active = crud.items?.filter((i) => !i.deletedAt) ?? [];
  const totalQty = active.reduce((s, i) => s + i.quantity, 0);
  const totalRemaining = active.reduce((s, i) => s + i.remaining, 0);

  if (crud.error) return <RequireRole roles={["owner", "auditor"]}><ErrorState message={crud.error} /></RequireRole>;
  if (!crud.items) return <RequireRole roles={["owner", "auditor"]}><LoadingState /></RequireRole>;

  const visible = crud.showDeleted ? crud.items : crud.items.filter((i) => !i.deletedAt);

  const renderForm = (mode: "add" | "edit") => (
    <Card className={`shadow-sm mb-4 ${mode === "edit" ? "border-amber-300" : "border-dashed"}`}>
      <CardContent className="pt-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">
          {mode === "add" ? "New Assembly Batch" : `Edit Batch #${editingId}`}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <FormField label="Product" className="col-span-2">
            <input type="text" value={formProduct} onChange={(e) => setFormProduct(e.target.value)} placeholder="e.g. Compound Fastened Boot" className={inputClass} autoFocus />
          </FormField>
          <FormField label="Assembly Date">
            <input type="date" value={formEffective} onChange={(e) => setFormEffective(e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Units Assembled">
            <input type="number" value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} placeholder="0" className={monoInputClass} />
          </FormField>
          <FormField label="Remaining (after install/sale)">
            <input type="number" value={formRemaining} onChange={(e) => setFormRemaining(e.target.value)} placeholder="0" className={monoInputClass} />
          </FormField>
        </div>

        {/* Components */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Printed Components</span>
            <Button variant="ghost" size="xs" onClick={() => setFormComponents([...formComponents, { ...emptyComponent }])}>+ Component</Button>
          </div>
          <div className="space-y-2">
            {formComponents.map((c, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_auto] gap-2 items-end">
                <select
                  value={c.batchId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const opt = componentOptions.find((o) => String(o.batchId) === id);
                    setFormComponents((prev) => {
                      const updated = [...prev];
                      updated[idx] = { ...updated[idx], batchId: id, ...(opt ? { part: opt.part } : {}) };
                      return updated;
                    });
                  }}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-background"
                >
                  <option value="">— Select batch —</option>
                  {componentOptions.filter((o) => o.remaining > 0).map((o) => (
                    <option key={o.batchId} value={String(o.batchId)}>
                      Batch #{o.batchId} — {o.part} ({o.remaining} on hand)
                    </option>
                  ))}
                </select>
                <input type="number" value={c.quantity} onChange={(e) => updateComponent(idx, "quantity", e.target.value)} placeholder="Qty" className={monoInputClass} />
                <Button variant="ghost" size="xs" className="text-red-600" onClick={() => setFormComponents(formComponents.filter((_, i) => i !== idx))}>
                  &times;
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Hardware */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Hardware</span>
            <Button variant="ghost" size="xs" onClick={() => setFormHardware([...formHardware, { ...emptyHardware }])}>+ Hardware</Button>
          </div>
          {formHardware.length === 0 && (
            <p className="text-xs text-muted-foreground">No hardware — click + to add fasteners, bolts, etc.</p>
          )}
          <div className="space-y-2">
            {formHardware.map((h, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_auto] gap-2 items-end">
                <select
                  value={h.hardwareId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const opt = hardwareOptions.find((o) => String(o.hardwareId) === id);
                    setFormHardware((prev) => {
                      const updated = [...prev];
                      updated[idx] = { ...updated[idx], hardwareId: id, ...(opt ? { item: opt.item } : {}) };
                      return updated;
                    });
                  }}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-background"
                >
                  <option value="">— Select hardware —</option>
                  {hardwareOptions.filter((o) => o.remaining > 0).map((o) => (
                    <option key={o.hardwareId} value={String(o.hardwareId)}>
                      #{o.hardwareId} — {o.item} ({o.remaining} on hand)
                    </option>
                  ))}
                </select>
                <input type="number" value={h.quantity} onChange={(e) => updateHw(idx, "quantity", e.target.value)} placeholder="Qty" className={monoInputClass} />
                <Button variant="ghost" size="xs" className="text-red-600" onClick={() => setFormHardware(formHardware.filter((_, i) => i !== idx))}>
                  &times;
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="xs" onClick={mode === "add" ? handleAdd : handleSaveEdit}>Save</Button>
          <Button variant="ghost" size="xs" onClick={() => { mode === "add" ? setAddingRow(false) : setEditingId(null); crud.setActionError(null); }}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <RequireRole roles={["owner", "auditor"]}>
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>&rsaquo;</span>
        <Link href="/manufacturing" className="hover:text-foreground transition-colors">Manufacturing</Link>
        <span>&rsaquo;</span>
        <span className="text-foreground">Inventory</span>
      </nav>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Inventory</h1>
          <p className="text-muted-foreground text-sm">
            {active.length} batches — {totalRemaining} / {totalQty} units remaining
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => crud.setShowDeleted(!crud.showDeleted)} className={crud.showDeleted ? "border-gray-400" : ""}>
            {crud.showDeleted ? "Hide Deleted" : "Show Deleted"}
          </Button>
          {writable && !addingRow && !editingId && (
            <Button variant="outline" size="sm" onClick={startAdd}>+ Add Batch</Button>
          )}
        </div>
      </div>

      {crud.actionError && (
        <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">{crud.actionError}</div>
      )}

      {addingRow && renderForm("add")}
      {editingId != null && renderForm("edit")}

      <div className="space-y-3">
        {visible.map((item) => {
          const deleted = !!item.deletedAt;
          const pct = item.quantity > 0 ? (item.remaining / item.quantity) * 100 : 0;
          const expanded = expandedId === item.inventoryId;
          const perUnit = (item.components.length + (item.hardware?.length ?? 0)) > 0;

          return (
            <Card key={item.inventoryId} className={`shadow-sm ${deleted ? "opacity-50" : ""}`}>
              <CardContent className="pt-4">
                {/* Summary row */}
                <div className="flex items-center gap-4">
                  <button
                    className="text-left flex-1 min-w-0"
                    onClick={() => setExpandedId(expanded ? null : item.inventoryId)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-mono shrink-0">#{item.inventoryId}</span>
                      <span className="font-medium truncate">{item.product}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{item.effective}</span>
                    </div>
                  </button>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <span className="font-mono text-sm">{item.remaining}</span>
                      <span className="text-xs text-muted-foreground"> / {item.quantity}</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
                    </div>
                    {perUnit && (
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setExpandedId(expanded ? null : item.inventoryId)}
                      >
                        {expanded ? "▲" : "▼"}
                      </button>
                    )}
                  </div>

                  {writable && (
                    <div className="flex items-center gap-1 shrink-0">
                      {deleted ? (
                        <>
                          <Button variant="ghost" size="xs" onClick={() => handleRestore(item.inventoryId)}>Restore</Button>
                          {confirmPermanentId === item.inventoryId ? (
                            <>
                              <span className="text-xs text-red-600">Purge?</span>
                              <Button variant="ghost" size="xs" className="text-red-600" onClick={() => handlePermanentDelete(item.inventoryId)} disabled={busyId === item.inventoryId}>
                                {busyId === item.inventoryId ? "..." : "Yes"}
                              </Button>
                              <Button variant="ghost" size="xs" onClick={() => setConfirmPermanentId(null)}>No</Button>
                            </>
                          ) : (
                            <Button variant="ghost" size="xs" className="text-red-600" onClick={() => setConfirmPermanentId(item.inventoryId)}>Purge</Button>
                          )}
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="xs" onClick={() => startEdit(item)}>Edit</Button>
                          {confirmDeleteId === item.inventoryId ? (
                            <>
                              <span className="text-xs text-red-600">Delete?</span>
                              <Button variant="ghost" size="xs" className="text-red-600" onClick={() => handleDelete(item.inventoryId)} disabled={busyId === item.inventoryId}>
                                {busyId === item.inventoryId ? "..." : "Yes"}
                              </Button>
                              <Button variant="ghost" size="xs" onClick={() => setConfirmDeleteId(null)}>No</Button>
                            </>
                          ) : (
                            <Button variant="ghost" size="xs" className="text-red-600" onClick={() => setConfirmDeleteId(item.inventoryId)}>Delete</Button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded BOM */}
                {expanded && (
                  <div className="mt-4 pt-3 border-t border-border/50">
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Components */}
                      {item.components.length > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Printed Components</div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-muted-foreground">
                                <th className="text-left font-medium pb-1">Batch</th>
                                <th className="text-left font-medium pb-1">Part</th>
                                <th className="text-right font-medium pb-1">Qty</th>
                                <th className="text-right font-medium pb-1">Per Unit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.components.map((c, idx) => (
                                <tr key={idx} className="border-t border-border/30">
                                  <td className="py-1 font-mono text-xs text-muted-foreground">#{c.batchId}</td>
                                  <td className="py-1">{c.part}</td>
                                  <td className="py-1 text-right font-mono">{c.quantity}</td>
                                  <td className="py-1 text-right font-mono text-xs text-muted-foreground">
                                    {item.quantity > 0 ? (c.quantity / item.quantity).toFixed(0) : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Hardware */}
                      {(item.hardware?.length ?? 0) > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Hardware</div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-muted-foreground">
                                <th className="text-left font-medium pb-1">Item</th>
                                <th className="text-right font-medium pb-1">Qty</th>
                                <th className="text-right font-medium pb-1">Per Unit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.hardware!.map((h, idx) => (
                                <tr key={idx} className="border-t border-border/30">
                                  <td className="py-1">{h.item}</td>
                                  <td className="py-1 text-right font-mono">{h.quantity}</td>
                                  <td className="py-1 text-right font-mono text-xs text-muted-foreground">
                                    {item.quantity > 0 ? (h.quantity / item.quantity).toFixed(0) : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
    </RequireRole>
  );
}
