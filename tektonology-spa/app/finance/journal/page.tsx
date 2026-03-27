"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/api-error";
import { useApiFetch } from "@/lib/api";
import { RequireRole } from "@/components/auth-guard";
import { useRole, canWrite } from "@/lib/auth";

interface JournalLine {
  accountNumber: number;
  accountName: string;
  debit: number | null;
  credit: number | null;
  description?: string;
}

interface JournalEntry {
  transactionId: number;
  effective: string;
  description: string;
  lines: JournalLine[];
  deletedAt?: string;
}

interface AccountInfo {
  number: number;
  name: string;
  type: string;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function codeColor(code: number): string {
  if (code < 2000) return "text-emerald-700";
  if (code < 3000) return "text-red-700";
  if (code < 4000) return "text-blue-700";
  if (code < 5000) return "text-emerald-700";
  return "text-orange-700";
}

const typeOrder = ["expense", "asset", "liability", "equity", "revenue", "cogs"];

interface EditLineItem {
  accountNumber: number | null;
  side: "debit" | "credit";
  amount: string;
  description: string;
}

function toEditLines(lines: JournalLine[]): EditLineItem[] {
  return lines.map((l) => ({
    accountNumber: l.accountNumber,
    side: l.debit != null ? "debit" : "credit",
    amount: String(l.debit ?? l.credit ?? 0),
    description: l.description ?? "",
  }));
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLines, setEditLines] = useState<EditLineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { role } = useRole();
  const apiFetch = useApiFetch();

  const load = useCallback(() => {
    Promise.all([
      apiFetch<JournalEntry[]>(`/api/finance/journal${showDeleted ? "?includeDeleted=true" : ""}`),
      apiFetch<AccountInfo[]>("/api/finance/accounts"),
    ])
      .then(([e, a]) => { setEntries(e); setAccounts(a); })
      .catch((e) => setError(e.message));
  }, [apiFetch, showDeleted]);

  useEffect(() => { load(); }, [load]);

  const grouped = new Map<string, AccountInfo[]>();
  for (const a of accounts) {
    const list = grouped.get(a.type) ?? [];
    list.push(a);
    grouped.set(a.type, list);
  }

  const startEdit = (entry: JournalEntry) => {
    setEditingId(entry.transactionId);
    setEditDate(entry.effective);
    setEditDescription(entry.description);
    setEditLines(toEditLines(entry.lines));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDate("");
    setEditDescription("");
    setEditLines([]);
  };

  const updateLine = (i: number, patch: Partial<EditLineItem>) => {
    setEditLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  };

  const addEditLine = () => {
    setEditLines((prev) => [...prev, { accountNumber: null, side: "debit", amount: "", description: "" }]);
  };

  const removeEditLine = (i: number) => {
    setEditLines((prev) => prev.filter((_, j) => j !== i));
  };

  const totalDebit = editLines
    .filter((l) => l.side === "debit" && l.amount)
    .reduce((s, l) => s + parseFloat(l.amount), 0);
  const totalCredit = editLines
    .filter((l) => l.side === "credit" && l.amount)
    .reduce((s, l) => s + parseFloat(l.amount), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005;
  const allFilled = editLines.every((l) => l.accountNumber != null && l.amount && parseFloat(l.amount) > 0);
  const canSave = balanced && allFilled && totalDebit > 0 && editDescription.trim().length > 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        effective: editDate,
        description: editDescription.trim(),
        lines: editLines.map((l) => {
          const acct = accounts.find((a) => a.number === l.accountNumber);
          return {
            accountNumber: l.accountNumber,
            accountName: acct!.name,
            debit: l.side === "debit" ? parseFloat(parseFloat(l.amount).toFixed(2)) : null,
            credit: l.side === "credit" ? parseFloat(parseFloat(l.amount).toFixed(2)) : null,
            description: l.description,
          };
        }),
      };
      await apiFetch(`/api/finance/journal/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      cancelEdit();
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (transactionId: number) => {
    setDeletingId(transactionId);
    try {
      await apiFetch(`/api/finance/journal/${transactionId}`, { method: "DELETE" });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestore = async (transactionId: number) => {
    try {
      await apiFetch(`/api/finance/journal/${transactionId}/restore`, { method: "POST" });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to restore");
    }
  };

  const [confirmPermanentDeleteId, setConfirmPermanentDeleteId] = useState<number | null>(null);

  const handlePermanentDelete = async (transactionId: number) => {
    setDeletingId(transactionId);
    try {
      await apiFetch(`/api/finance/journal/${transactionId}/permanent`, { method: "DELETE" });
      setConfirmPermanentDeleteId(null);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to permanently delete");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <RequireRole roles={["owner", "auditor"]}>
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>›</span>
        <Link href="/finance" className="hover:text-foreground transition-colors">Finance</Link>
        <span>›</span>
        <span className="text-foreground">Journal</span>
      </nav>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Journal</h1>
          {entries && (
            <p className="text-muted-foreground text-sm">
              {entries.filter((e) => !e.deletedAt).length} transactions.
              {showDeleted && entries.some((e) => e.deletedAt) && (
                <span className="ml-1 text-gray-400">({entries.filter((e) => e.deletedAt).length} deleted)</span>
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
          {canWrite(role) && (
            <Link href="/finance/new">
              <Button variant="outline" size="sm">+ New Transaction</Button>
            </Link>
          )}
        </div>
      </div>

      {error && <ErrorState message={error} />}
      {!entries && !error && <LoadingState />}

      {entries && (
        <div className="space-y-3">
          {entries.map((entry) => {
            const dr = entry.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
            const cr = entry.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
            const unbalanced = Math.abs(dr - cr) >= 0.005;
            const isDeleted = !!entry.deletedAt;
            return (
            <Card key={entry.transactionId} className={`shadow-sm ${isDeleted ? "opacity-50 border-dashed" : ""} ${unbalanced && !isDeleted ? "border-red-400 bg-red-50/50" : ""}`}>
              {editingId != null && editingId === entry.transactionId ? (
                /* ---- Edit mode ---- */
                <>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Editing Transaction #{entry.transactionId}</CardTitle>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={cancelEdit}>Cancel</Button>
                        <Button size="sm" onClick={handleSave} disabled={!canSave || saving}>
                          {saving ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-3 mb-4">
                      <div className="flex items-center gap-4">
                        <label className="text-sm text-muted-foreground w-20">Date</label>
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="border border-border rounded-md px-3 py-1.5 text-sm bg-background text-foreground"
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="text-sm text-muted-foreground w-20">Description</label>
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="flex-1 border border-border rounded-md px-3 py-1.5 text-sm bg-background text-foreground"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Line Items</span>
                      <Button variant="outline" size="sm" onClick={addEditLine}>+ Add Line</Button>
                    </div>
                    <div className="space-y-2">
                      {editLines.map((line, i) => (
                        <div key={i} className="flex flex-wrap items-start gap-2 pb-2 border-b border-border/50 last:border-0 last:pb-0">
                          <div className="flex-1 min-w-[200px]">
                            <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Account</label>
                            <select
                              value={line.accountNumber ?? ""}
                              onChange={(e) => updateLine(i, { accountNumber: e.target.value ? parseInt(e.target.value) : null })}
                              className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background text-foreground"
                            >
                              <option value="">Select account...</option>
                              {typeOrder.filter((t) => grouped.has(t)).map((type) => (
                                <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1)}>
                                  {grouped.get(type)!.map((a) => (
                                    <option key={a.number} value={a.number}>
                                      {a.number}: {a.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Side</label>
                            <select
                              value={line.side}
                              onChange={(e) => updateLine(i, { side: e.target.value as "debit" | "credit" })}
                              className="border border-border rounded-md px-3 py-1.5 text-sm bg-background text-foreground"
                            >
                              <option value="debit">Debit</option>
                              <option value="credit">Credit</option>
                            </select>
                          </div>
                          <div className="w-28">
                            <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Amount</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={line.amount}
                              onChange={(e) => updateLine(i, { amount: e.target.value })}
                              className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background text-foreground font-mono text-right"
                            />
                          </div>
                          <div className="flex-1 min-w-[150px]">
                            <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Memo</label>
                            <input
                              type="text"
                              placeholder="Line memo..."
                              value={line.description}
                              onChange={(e) => updateLine(i, { description: e.target.value })}
                              className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background text-foreground"
                            />
                          </div>
                          <div className="pt-5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeEditLine(i)}
                              disabled={editLines.length <= 2}
                              className="text-muted-foreground hover:text-red-600"
                            >
                              x
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">Debits: <span className="font-mono font-semibold">${totalDebit.toFixed(2)}</span></span>
                      <span className="text-muted-foreground">Credits: <span className="font-mono font-semibold">${totalCredit.toFixed(2)}</span></span>
                      {totalDebit > 0 && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${balanced ? "bg-emerald-100 text-emerald-900 border-emerald-300" : "bg-red-100 text-red-900 border-red-300"}`}>
                          {balanced ? "Balanced" : `Off by $${Math.abs(totalDebit - totalCredit).toFixed(2)}`}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </>
              ) : (
                /* ---- Read mode ---- */
                <>
                  <CardHeader className="pb-0">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">
                        Transaction #{entry.transactionId}
                        {entry.description && (
                          <span className="ml-2 font-normal text-muted-foreground">— {entry.description}</span>
                        )}
                        {unbalanced && (
                          <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-900 border border-red-300">
                            Unbalanced (off by ${Math.abs(dr - cr).toFixed(2)})
                          </span>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{entry.effective}</span>
                        {isDeleted && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-300">
                            Deleted
                          </span>
                        )}
                        {canWrite(role) && isDeleted && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => handleRestore(entry.transactionId)}
                            >
                              Restore
                            </Button>
                            {confirmPermanentDeleteId === entry.transactionId ? (
                              <>
                                <span className="text-xs text-red-600">Permanently delete?</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handlePermanentDelete(entry.transactionId)}
                                  disabled={deletingId === entry.transactionId}
                                >
                                  {deletingId === entry.transactionId ? "Deleting..." : "Yes"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => setConfirmPermanentDeleteId(null)}
                                >
                                  No
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setConfirmPermanentDeleteId(entry.transactionId)}
                              >
                                Purge
                              </Button>
                            )}
                          </>
                        )}
                        {canWrite(role) && !isDeleted && (
                          <>
                            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => startEdit(entry)}>
                              Edit
                            </Button>
                            {confirmDeleteId === entry.transactionId ? (
                              <>
                                <span className="text-xs text-red-600">Delete?</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => { setConfirmDeleteId(null); handleDelete(entry.transactionId); }}
                                >
                                  Yes
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => setConfirmDeleteId(null)}
                                >
                                  No
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setConfirmDeleteId(entry.transactionId)}
                              >
                                Delete
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                          <th className="text-left font-medium pb-1">Account</th>
                          <th className="text-right font-medium pb-1 w-28 px-3">Debit</th>
                          <th className="text-right font-medium pb-1 w-28 px-3">Credit</th>
                          <th className="text-left font-medium pb-1 pl-4">Memo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.lines.map((line, i) => (
                          <tr key={i} className="border-t border-border/50">
                            <td className="py-1.5">
                              <span className={`font-mono text-xs ${codeColor(line.accountNumber)}`}>{line.accountNumber}</span>
                              <span className="ml-2 text-foreground">{line.accountName}</span>
                            </td>
                            <td className="text-right font-mono py-1.5 px-3">
                              {line.debit != null ? fmt(line.debit) : ""}
                            </td>
                            <td className="text-right font-mono py-1.5 px-3">
                              {line.credit != null ? fmt(line.credit) : ""}
                            </td>
                            <td className="py-1.5 text-xs text-muted-foreground pl-4">
                              {line.description ?? ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </>
              )}
            </Card>
            );
          })}
        </div>
      )}
    </div>
    </RequireRole>
  );
}
