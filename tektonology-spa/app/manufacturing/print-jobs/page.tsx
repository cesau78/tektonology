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

interface PrintJobData {
  _id: string;
  batchId: number;
  date: string;
  project: string;
  product: string;
  spool: string;
  usageG: number;
  totalHours: number;
  cost: number;
  success: boolean | null;
  usage: string;
  quantity: number;
  part: string;
  comments: string;
  deletedAt?: string;
}

interface EditValues {
  date: string;
  batchId: string;
  part: string;
  usage: string;
  quantity: string;
  usageG: string;
  totalHours: string;
  cost: string;
  success: string;
  comments: string;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const usageTypes = ["Prototype", "Inventory", "Scrap", "Shop"] as const;

const usageBadge: Record<string, string> = {
  Prototype: "bg-blue-100 text-blue-900 border-blue-300",
  Inventory: "bg-emerald-100 text-emerald-900 border-emerald-300",
  Scrap: "bg-red-100 text-red-900 border-red-300",
  Shop: "bg-violet-100 text-violet-900 border-violet-300",
};

const emptyNewRow: EditValues = {
  date: new Date().toISOString().slice(0, 10),
  batchId: "",
  part: "",
  usage: "Inventory",
  quantity: "1",
  usageG: "0",
  totalHours: "0",
  cost: "0",
  success: "null",
  comments: "",
};

function parseSuccess(val: string): boolean | null {
  if (val === "true") return true;
  if (val === "false") return false;
  return null;
}

function successToString(val: boolean | null): string {
  if (val === true) return "true";
  if (val === false) return "false";
  return "null";
}

export default function PrintJobsPage() {
  const [jobs, setJobs] = useState<PrintJobData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditValues>(emptyNewRow);
  const [addingRow, setAddingRow] = useState(false);
  const [newRow, setNewRow] = useState<EditValues>({ ...emptyNewRow });
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmPermanentDeleteId, setConfirmPermanentDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { role } = useRole();
  const apiFetch = useApiFetch();
  const writable = canWrite(role);

  const load = useCallback(() => {
    apiFetch<PrintJobData[]>(`/api/manufacturing/print-jobs${showDeleted ? "?includeDeleted=true" : ""}`)
      .then(setJobs)
      .catch((e) => setError(e.message));
  }, [apiFetch, showDeleted]);

  useEffect(() => { load(); }, [load]);

  const activeJobs = jobs?.filter((j) => !j.deletedAt) ?? [];
  const totalHours = activeJobs.reduce((s, j) => s + (j.totalHours ?? 0), 0);
  const totalCost = activeJobs.reduce((s, j) => s + (j.cost ?? 0), 0);
  const totalUsage = activeJobs.reduce((s, j) => s + (j.usageG ?? 0), 0);

  // Group by usage type — only non-deleted
  const byUsage: Record<string, { count: number; hours: number; cost: number }> = {};
  for (const j of activeJobs) {
    const u = j.usage || "Unknown";
    if (!byUsage[u]) byUsage[u] = { count: 0, hours: 0, cost: 0 };
    byUsage[u].count++;
    byUsage[u].hours += j.totalHours ?? 0;
    byUsage[u].cost += j.cost ?? 0;
  }

  const startEdit = (j: PrintJobData) => {
    setEditingId(j._id);
    setEditValues({
      date: j.date,
      batchId: String(j.batchId),
      part: j.part,
      usage: j.usage,
      quantity: String(j.quantity),
      usageG: String(j.usageG),
      totalHours: String(j.totalHours),
      cost: String(j.cost),
      success: successToString(j.success),
      comments: j.comments ?? "",
    });
    setActionError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setActionError(null);
  };

  const saveEdit = async (id: string) => {
    setActionError(null);
    const batchId = parseInt(editValues.batchId, 10);
    if (Number.isNaN(batchId) || batchId <= 0) {
      setActionError("Batch ID must be a positive integer");
      return;
    }
    if (!editValues.part.trim()) {
      setActionError("Part name is required");
      return;
    }
    if (!editValues.date.trim()) {
      setActionError("Date is required");
      return;
    }
    try {
      await apiFetch(`/api/manufacturing/print-jobs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: editValues.date.trim(),
          batchId,
          part: editValues.part.trim(),
          usage: editValues.usage,
          quantity: parseInt(editValues.quantity, 10) || 0,
          usageG: parseFloat(editValues.usageG) || 0,
          totalHours: parseFloat(editValues.totalHours) || 0,
          cost: parseFloat(editValues.cost) || 0,
          success: parseSuccess(editValues.success),
          comments: editValues.comments.trim(),
        }),
      });
      setEditingId(null);
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setActionError(null);
    try {
      await apiFetch(`/api/manufacturing/print-jobs/${id}`, { method: "DELETE" });
      setConfirmDeleteId(null);
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestore = async (id: string) => {
    setActionError(null);
    try {
      await apiFetch(`/api/manufacturing/print-jobs/${id}/restore`, { method: "POST" });
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to restore");
    }
  };

  const handlePermanentDelete = async (id: string) => {
    setDeletingId(id);
    setActionError(null);
    try {
      await apiFetch(`/api/manufacturing/print-jobs/${id}/permanent`, { method: "DELETE" });
      setConfirmPermanentDeleteId(null);
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to permanently delete");
    } finally {
      setDeletingId(null);
    }
  };

  const addJob = async () => {
    setActionError(null);
    const batchId = parseInt(newRow.batchId, 10);
    if (Number.isNaN(batchId) || batchId <= 0) {
      setActionError("Batch ID must be a positive integer");
      return;
    }
    if (!newRow.part.trim()) {
      setActionError("Part name is required");
      return;
    }
    if (!newRow.date.trim()) {
      setActionError("Date is required");
      return;
    }
    try {
      await apiFetch("/api/manufacturing/print-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: newRow.date.trim(),
          batchId,
          part: newRow.part.trim(),
          usage: newRow.usage,
          quantity: parseInt(newRow.quantity, 10) || 0,
          usageG: parseFloat(newRow.usageG) || 0,
          totalHours: parseFloat(newRow.totalHours) || 0,
          cost: parseFloat(newRow.cost) || 0,
          success: parseSuccess(newRow.success),
          comments: newRow.comments.trim(),
        }),
      });
      setAddingRow(false);
      setNewRow({ ...emptyNewRow });
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
        <Link href="/manufacturing" className="hover:text-foreground transition-colors">Manufacturing</Link>
        <span>›</span>
        <span className="text-foreground">Print Jobs</span>
      </nav>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Print Jobs</h1>
          {jobs && (
            <p className="text-muted-foreground text-sm">
              {activeJobs.length} jobs — {totalHours.toFixed(0)} hours — {(totalUsage / 1000).toFixed(1)} kg used — {fmt(totalCost)} in materials
              {showDeleted && jobs.some((j) => j.deletedAt) && (
                <span className="text-gray-400"> ({jobs.filter((j) => j.deletedAt).length} deleted)</span>
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
              + Add Job
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorState message={error} />}
      {!jobs && !error && <LoadingState />}

      {actionError && (
        <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">{actionError}</div>
      )}

      {jobs && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {Object.entries(byUsage).map(([type, stats]) => (
              <Card key={type} className="shadow-sm">
                <CardContent className="pt-4 pb-4">
                  <Badge className={`${usageBadge[type] ?? "bg-gray-100 text-gray-900 border-gray-300"} hover:bg-opacity-100 mb-2`}>
                    {type}
                  </Badge>
                  <p className="text-lg font-semibold">{stats.count}</p>
                  <p className="text-xs text-muted-foreground">{stats.hours.toFixed(0)} hrs — {fmt(stats.cost)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="shadow-sm overflow-x-auto">
            <CardContent className="pt-4">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left font-medium pb-2">Batch</th>
                    <th className="text-left font-medium pb-2">Date</th>
                    <th className="text-left font-medium pb-2">Part</th>
                    <th className="text-center font-medium pb-2">Status</th>
                    <th className="text-left font-medium pb-2">Type</th>
                    <th className="text-right font-medium pb-2">Qty</th>
                    <th className="text-right font-medium pb-2">Grams</th>
                    <th className="text-right font-medium pb-2">Hours</th>
                    <th className="text-right font-medium pb-2">Cost</th>
                    <th className="text-left font-medium pb-2">Comments</th>
                    {writable && <th className="text-right font-medium pb-2">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {addingRow && (
                    <tr className="border-t border-border bg-muted/30">
                      <td className="py-1.5 pr-1">
                        <input
                          type="number"
                          value={newRow.batchId}
                          onChange={(e) => setNewRow({ ...newRow, batchId: e.target.value })}
                          placeholder="1"
                          className={`${inputClass} font-mono`}
                          autoFocus
                        />
                      </td>
                      <td className="py-1.5 pr-1">
                        <input
                          type="date"
                          value={newRow.date}
                          onChange={(e) => setNewRow({ ...newRow, date: e.target.value })}
                          className={inputClass}
                        />
                      </td>
                      <td className="py-1.5 pr-1">
                        <input
                          type="text"
                          value={newRow.part}
                          onChange={(e) => setNewRow({ ...newRow, part: e.target.value })}
                          placeholder="Part name"
                          className={inputClass}
                        />
                      </td>
                      <td className="py-1.5 pr-1">
                        <select
                          value={newRow.success}
                          onChange={(e) => setNewRow({ ...newRow, success: e.target.value })}
                          className={inputClass}
                        >
                          <option value="null">—</option>
                          <option value="true">Pass</option>
                          <option value="false">Fail</option>
                        </select>
                      </td>
                      <td className="py-1.5 pr-1">
                        <select
                          value={newRow.usage}
                          onChange={(e) => setNewRow({ ...newRow, usage: e.target.value })}
                          className={inputClass}
                        >
                          {usageTypes.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1.5 pr-1">
                        <input
                          type="number"
                          value={newRow.quantity}
                          onChange={(e) => setNewRow({ ...newRow, quantity: e.target.value })}
                          className={`${inputClass} font-mono text-right`}
                        />
                      </td>
                      <td className="py-1.5 pr-1">
                        <input
                          type="number"
                          value={newRow.usageG}
                          onChange={(e) => setNewRow({ ...newRow, usageG: e.target.value })}
                          className={`${inputClass} font-mono text-right`}
                        />
                      </td>
                      <td className="py-1.5 pr-1">
                        <input
                          type="number"
                          step="0.1"
                          value={newRow.totalHours}
                          onChange={(e) => setNewRow({ ...newRow, totalHours: e.target.value })}
                          className={`${inputClass} font-mono text-right`}
                        />
                      </td>
                      <td className="py-1.5 pr-1">
                        <input
                          type="number"
                          step="0.01"
                          value={newRow.cost}
                          onChange={(e) => setNewRow({ ...newRow, cost: e.target.value })}
                          className={`${inputClass} font-mono text-right`}
                        />
                      </td>
                      <td className="py-1.5 pr-1">
                        <input
                          type="text"
                          value={newRow.comments}
                          onChange={(e) => setNewRow({ ...newRow, comments: e.target.value })}
                          placeholder="Comments"
                          className={inputClass}
                        />
                      </td>
                      <td className="py-1.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="xs" onClick={addJob}>Save</Button>
                          <Button variant="ghost" size="xs" onClick={() => { setAddingRow(false); setActionError(null); }}>Cancel</Button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {jobs.map((j) => {
                    const isDeleted = !!j.deletedAt;
                    const isEditing = editingId === j._id;
                    return (
                    <tr key={j._id} className={`border-t border-border/50 hover:bg-muted/20 transition-colors ${isDeleted ? "opacity-50" : ""}`}>
                      <td className="py-1.5 font-mono text-xs text-muted-foreground">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editValues.batchId}
                            onChange={(e) => setEditValues({ ...editValues, batchId: e.target.value })}
                            className={`${inputClass} font-mono`}
                          />
                        ) : (
                          j.batchId
                        )}
                      </td>
                      <td className="py-1.5 text-xs">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editValues.date}
                            onChange={(e) => setEditValues({ ...editValues, date: e.target.value })}
                            className={inputClass}
                            autoFocus
                          />
                        ) : (
                          j.date
                        )}
                      </td>
                      <td className="py-1.5">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValues.part}
                            onChange={(e) => setEditValues({ ...editValues, part: e.target.value })}
                            className={inputClass}
                          />
                        ) : (
                          <>
                            <span className="text-foreground">{j.part}</span>
                            {j.comments && (
                              <span className="ml-1 text-xs text-muted-foreground" title={j.comments}>*</span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-1.5 text-center">
                        {isEditing ? (
                          <select
                            value={editValues.success}
                            onChange={(e) => setEditValues({ ...editValues, success: e.target.value })}
                            className={inputClass}
                          >
                            <option value="null">—</option>
                            <option value="true">Pass</option>
                            <option value="false">Fail</option>
                          </select>
                        ) : (
                          <span className={j.success === true ? "text-emerald-600" : j.success === false ? "text-red-600" : "text-muted-foreground"}>
                            {j.success === true ? "Pass" : j.success === false ? "Fail" : "—"}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5">
                        {isEditing ? (
                          <select
                            value={editValues.usage}
                            onChange={(e) => setEditValues({ ...editValues, usage: e.target.value })}
                            className={inputClass}
                          >
                            {usageTypes.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        ) : (
                          <Badge variant="outline" className={`text-xs ${usageBadge[j.usage] ?? ""} hover:bg-opacity-100`}>
                            {j.usage}
                          </Badge>
                        )}
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editValues.quantity}
                            onChange={(e) => setEditValues({ ...editValues, quantity: e.target.value })}
                            className={`${inputClass} font-mono text-right`}
                          />
                        ) : (
                          j.quantity
                        )}
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editValues.usageG}
                            onChange={(e) => setEditValues({ ...editValues, usageG: e.target.value })}
                            className={`${inputClass} font-mono text-right`}
                          />
                        ) : (
                          (j.usageG ?? 0).toFixed(0)
                        )}
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.1"
                            value={editValues.totalHours}
                            onChange={(e) => setEditValues({ ...editValues, totalHours: e.target.value })}
                            className={`${inputClass} font-mono text-right`}
                          />
                        ) : (
                          (j.totalHours ?? 0).toFixed(1)
                        )}
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editValues.cost}
                            onChange={(e) => setEditValues({ ...editValues, cost: e.target.value })}
                            className={`${inputClass} font-mono text-right`}
                          />
                        ) : (
                          fmt(j.cost ?? 0)
                        )}
                      </td>
                      <td className="py-1.5 text-xs text-muted-foreground">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValues.comments}
                            onChange={(e) => setEditValues({ ...editValues, comments: e.target.value })}
                            className={inputClass}
                          />
                        ) : (
                          j.comments
                        )}
                      </td>
                      {writable && (
                        <td className="py-1.5 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="xs" onClick={() => saveEdit(j._id)}>Save</Button>
                              <Button variant="ghost" size="xs" onClick={cancelEdit}>Cancel</Button>
                            </div>
                          ) : isDeleted ? (
                            <div className="flex justify-end gap-1 items-center">
                              <Button variant="ghost" size="xs" onClick={() => handleRestore(j._id)}>Restore</Button>
                              {confirmPermanentDeleteId === j._id ? (
                                <>
                                  <span className="text-xs text-red-600">Purge?</span>
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => handlePermanentDelete(j._id)}
                                    disabled={deletingId === j._id}
                                  >
                                    {deletingId === j._id ? "..." : "Yes"}
                                  </Button>
                                  <Button variant="ghost" size="xs" onClick={() => setConfirmPermanentDeleteId(null)}>No</Button>
                                </>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => setConfirmPermanentDeleteId(j._id)}
                                >
                                  Purge
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1 items-center">
                              <Button variant="ghost" size="xs" onClick={() => startEdit(j)}>Edit</Button>
                              {confirmDeleteId === j._id ? (
                                <>
                                  <span className="text-xs text-red-600">Delete?</span>
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => handleDelete(j._id)}
                                    disabled={deletingId === j._id}
                                  >
                                    {deletingId === j._id ? "..." : "Yes"}
                                  </Button>
                                  <Button variant="ghost" size="xs" onClick={() => setConfirmDeleteId(null)}>No</Button>
                                </>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => setConfirmDeleteId(j._id)}
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
        </>
      )}
    </div>
    </RequireRole>
  );
}
