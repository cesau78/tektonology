"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RequireRole } from "@/components/auth-guard";
import { useRole, canWrite } from "@/lib/auth";
import { useCrud } from "@/lib/use-crud";
import { LoadingState, ErrorState } from "@/components/api-error";

interface SaleItemData {
  inventoryId: number;
  product: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface SaleData {
  saleId: number;
  effective: string;
  customer: string;
  items: SaleItemData[];
  revenue: number;
  journalId?: number;
  deletedAt?: string;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function SalesPage() {
  const crud = useCrud<SaleData>("/api/sales");
  const { role } = useRole();
  const writable = canWrite(role);
  const [adding, setAdding] = useState(false);
  const [newSale, setNewSale] = useState({ effective: "", customer: "", revenue: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({ effective: "", customer: "", revenue: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handleAdd = async () => {
    if (!newSale.customer.trim() || !newSale.effective) { crud.setActionError("Customer and date required"); return; }
    try {
      await crud.create({
        effective: newSale.effective,
        customer: newSale.customer.trim(),
        items: [],
        revenue: parseFloat(newSale.revenue) || 0,
      } as Partial<SaleData>);
      setAdding(false);
      setNewSale({ effective: "", customer: "", revenue: "" });
    } catch { /* */ }
  };

  const saveEdit = async (saleId: number) => {
    try {
      await crud.update(saleId, {
        effective: editValues.effective,
        customer: editValues.customer.trim(),
        revenue: parseFloat(editValues.revenue) || 0,
      } as Partial<SaleData>);
      setEditingId(null);
    } catch { /* */ }
  };

  const visible = crud.showDeleted ? crud.items : crud.items?.filter((s) => !s.deletedAt);
  const activeSales = crud.items?.filter((s) => !s.deletedAt) ?? [];
  const totalRevenue = activeSales.reduce((s, sale) => s + sale.revenue, 0);

  return (
    <RequireRole roles={["owner"]}>
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>&rsaquo;</span>
        <span className="text-foreground">Sales</span>
      </nav>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Sales</h1>
          {crud.items && (
            <p className="text-muted-foreground text-sm">
              {activeSales.length} sales — {fmt(totalRevenue)} total revenue
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => crud.setShowDeleted(!crud.showDeleted)} className={crud.showDeleted ? "border-gray-400" : ""}>
            {crud.showDeleted ? "Hide Deleted" : "Show Deleted"}
          </Button>
          {writable && !adding && (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>+ Add Sale</Button>
          )}
        </div>
      </div>

      {crud.error && <ErrorState message={crud.error} />}
      {!crud.items && !crud.error && <LoadingState />}

      {crud.actionError && (
        <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">{crud.actionError}</div>
      )}

      {adding && (
        <Card className="shadow-sm border-dashed mb-4">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">New Sale</div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <input type="date" value={newSale.effective} onChange={(e) => setNewSale({ ...newSale, effective: e.target.value })} className="border border-border rounded px-2 py-1 text-sm bg-background" autoFocus />
              <input type="text" value={newSale.customer} onChange={(e) => setNewSale({ ...newSale, customer: e.target.value })} placeholder="Customer" className="border border-border rounded px-2 py-1 text-sm bg-background" />
              <input type="number" value={newSale.revenue} onChange={(e) => setNewSale({ ...newSale, revenue: e.target.value })} placeholder="Revenue" className="border border-border rounded px-2 py-1 text-sm bg-background font-mono" />
            </div>
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="xs" onClick={handleAdd}>Save</Button>
              <Button variant="ghost" size="xs" onClick={() => { setAdding(false); crud.setActionError(null); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {visible && (
        <Card className="shadow-sm">
          <CardContent className="pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left font-medium pb-2">#</th>
                  <th className="text-left font-medium pb-2">Date</th>
                  <th className="text-left font-medium pb-2">Customer</th>
                  <th className="text-right font-medium pb-2">Items</th>
                  <th className="text-right font-medium pb-2">Revenue</th>
                  {writable && <th className="text-right font-medium pb-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((sale) => {
                  const deleted = !!sale.deletedAt;
                  const editing = editingId === sale.saleId;
                  return (
                    <tr key={sale.saleId} className={`border-t border-border/50 ${deleted ? "opacity-50" : ""}`}>
                      <td className="py-1.5 font-mono text-xs text-muted-foreground">{sale.saleId}</td>
                      <td className="py-1.5">
                        {editing ? (
                          <input type="date" value={editValues.effective} onChange={(e) => setEditValues({ ...editValues, effective: e.target.value })} className="border border-border rounded px-2 py-1 text-sm bg-background" />
                        ) : sale.effective}
                      </td>
                      <td className="py-1.5">
                        {editing ? (
                          <input type="text" value={editValues.customer} onChange={(e) => setEditValues({ ...editValues, customer: e.target.value })} className="w-full border border-border rounded px-2 py-1 text-sm bg-background" />
                        ) : sale.customer}
                      </td>
                      <td className="py-1.5 text-right font-mono text-xs">{sale.items.length}</td>
                      <td className="py-1.5 text-right font-mono">
                        {editing ? (
                          <input type="number" value={editValues.revenue} onChange={(e) => setEditValues({ ...editValues, revenue: e.target.value })} className="w-24 border border-border rounded px-2 py-1 text-sm bg-background font-mono text-right" />
                        ) : fmt(sale.revenue)}
                      </td>
                      {writable && (
                        <td className="py-1.5 text-right">
                          {editing ? (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="xs" onClick={() => saveEdit(sale.saleId)}>Save</Button>
                              <Button variant="ghost" size="xs" onClick={() => setEditingId(null)}>Cancel</Button>
                            </div>
                          ) : deleted ? (
                            <Button variant="ghost" size="xs" onClick={() => crud.restore(sale.saleId)}>Restore</Button>
                          ) : (
                            <div className="flex justify-end gap-1 items-center">
                              <Button variant="ghost" size="xs" onClick={() => { setEditingId(sale.saleId); setEditValues({ effective: sale.effective, customer: sale.customer, revenue: String(sale.revenue) }); }}>Edit</Button>
                              {confirmDeleteId === sale.saleId ? (
                                <>
                                  <span className="text-xs text-red-600">Delete?</span>
                                  <Button variant="ghost" size="xs" className="text-red-600" onClick={() => { crud.remove(sale.saleId); setConfirmDeleteId(null); }}>Yes</Button>
                                  <Button variant="ghost" size="xs" onClick={() => setConfirmDeleteId(null)}>No</Button>
                                </>
                              ) : (
                                <Button variant="ghost" size="xs" className="text-red-600" onClick={() => setConfirmDeleteId(sale.saleId)}>Delete</Button>
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
