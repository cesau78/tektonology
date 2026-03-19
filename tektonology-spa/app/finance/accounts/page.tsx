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

interface Account {
  number: number;
  name: string;
  type: string;
  balance: number;
}

type SortField = "number" | "name" | "type" | "balance";
type SortDir = "asc" | "desc";

const accountTypes = ["asset", "liability", "equity", "revenue", "cogs", "expense"] as const;

const typeLabels: Record<string, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  cogs: "COGS",
  expense: "Expense",
};

const typeColors: Record<string, string> = {
  asset: "bg-emerald-100 text-emerald-900 border-emerald-300",
  liability: "bg-red-100 text-red-900 border-red-300",
  equity: "bg-blue-100 text-blue-900 border-blue-300",
  revenue: "bg-violet-100 text-violet-900 border-violet-300",
  cogs: "bg-orange-100 text-orange-900 border-orange-300",
  expense: "bg-amber-100 text-amber-900 border-amber-300",
};

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <span className="ml-1 text-muted-foreground/30">&#8597;</span>;
  return <span className="ml-1">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>;
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("number");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ number: string; name: string; type: string }>({ number: "", name: "", type: "" });
  const [addingRow, setAddingRow] = useState(false);
  const [newRow, setNewRow] = useState({ number: "", name: "", type: "asset" });
  const [actionError, setActionError] = useState<string | null>(null);
  const { role } = useRole();
  const apiFetch = useApiFetch();
  const writable = canWrite(role);

  const load = useCallback(() => {
    apiFetch<Account[]>("/api/finance/accounts")
      .then(setAccounts)
      .catch((e) => setError(e.message));
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sorted = accounts
    ? [...accounts].sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortField === "number") return (a.number - b.number) * dir;
        if (sortField === "balance") return (a.balance - b.balance) * dir;
        const av = a[sortField].toLowerCase();
        const bv = b[sortField].toLowerCase();
        return av < bv ? -dir : av > bv ? dir : 0;
      })
    : null;

  const startEdit = (acct: Account) => {
    setEditingRow(acct.number);
    setEditValues({ number: String(acct.number), name: acct.name, type: acct.type });
    setActionError(null);
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setActionError(null);
  };

  const saveEdit = async (originalNum: number) => {
    setActionError(null);
    const newNum = parseInt(editValues.number, 10);
    if (Number.isNaN(newNum) || newNum <= 0) {
      setActionError("Account code must be a positive integer");
      return;
    }
    if (!editValues.name.trim()) {
      setActionError("Account name is required");
      return;
    }
    if (newNum !== originalNum && accounts?.some((a) => a.number === newNum)) {
      setActionError(`Account code ${newNum} already exists`);
      return;
    }
    if (accounts?.some((a) => a.number !== originalNum && a.name.toLowerCase() === editValues.name.trim().toLowerCase())) {
      setActionError(`Account name "${editValues.name.trim()}" already exists`);
      return;
    }
    try {
      await apiFetch(`/api/finance/accounts/${originalNum}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: newNum, name: editValues.name.trim(), type: editValues.type }),
      });
      setEditingRow(null);
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const deleteAccount = async (num: number, name: string) => {
    if (!confirm(`Delete account ${num}: ${name}?`)) return;
    setActionError(null);
    try {
      await apiFetch(`/api/finance/accounts/${num}`, { method: "DELETE" });
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const addAccount = async () => {
    setActionError(null);
    const num = parseInt(newRow.number, 10);
    if (Number.isNaN(num) || num <= 0) {
      setActionError("Account code must be a positive integer");
      return;
    }
    if (!newRow.name.trim()) {
      setActionError("Account name is required");
      return;
    }
    if (accounts?.some((a) => a.number === num)) {
      setActionError(`Account code ${num} already exists`);
      return;
    }
    if (accounts?.some((a) => a.name.toLowerCase() === newRow.name.trim().toLowerCase())) {
      setActionError(`Account name "${newRow.name.trim()}" already exists`);
      return;
    }
    try {
      await apiFetch("/api/finance/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: num, name: newRow.name.trim(), type: newRow.type, balance: 0 }),
      });
      setAddingRow(false);
      setNewRow({ number: "", name: "", type: "asset" });
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to add");
    }
  };

  const thClass = "text-left font-medium pb-2 text-xs text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors";

  return (
    <RequireRole roles={["owner", "auditor"]}>
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>›</span>
        <Link href="/finance" className="hover:text-foreground transition-colors">Finance</Link>
        <span>›</span>
        <span className="text-foreground">Chart of Accounts</span>
      </nav>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Chart of Accounts</h1>
          {accounts && (
            <p className="text-muted-foreground text-sm">{accounts.length} accounts. Click column headers to sort.</p>
          )}
        </div>
        {writable && !addingRow && (
          <Button variant="outline" size="sm" onClick={() => { setAddingRow(true); setActionError(null); }}>
            + Add Account
          </Button>
        )}
      </div>

      {error && <ErrorState message={error} />}
      {!accounts && !error && <LoadingState />}

      {actionError && (
        <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">{actionError}</div>
      )}

      {sorted && (
        <Card className="shadow-sm">
          <CardContent className="pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={`${thClass} w-24`} onClick={() => toggleSort("number")}>
                    Code<SortIcon field="number" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th className={thClass} onClick={() => toggleSort("name")}>
                    Name<SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th className={`${thClass} w-32`} onClick={() => toggleSort("type")}>
                    Type<SortIcon field="type" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th className={`${thClass} w-32 !text-right`} onClick={() => toggleSort("balance")}>
                    Balance<SortIcon field="balance" sortField={sortField} sortDir={sortDir} />
                  </th>
                  {writable && <th className={`${thClass} w-28 !text-right !cursor-default hover:!text-muted-foreground`}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {addingRow && (
                  <tr className="border-t border-border bg-muted/30">
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        value={newRow.number}
                        onChange={(e) => setNewRow({ ...newRow, number: e.target.value })}
                        placeholder="1101"
                        className="w-full border border-border rounded px-2 py-1 text-sm bg-background font-mono"
                        autoFocus
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={newRow.name}
                        onChange={(e) => setNewRow({ ...newRow, name: e.target.value })}
                        placeholder="Account name"
                        className="w-full border border-border rounded px-2 py-1 text-sm bg-background"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        value={newRow.type}
                        onChange={(e) => setNewRow({ ...newRow, type: e.target.value })}
                        className="w-full border border-border rounded px-2 py-1 text-sm bg-background"
                      >
                        {accountTypes.map((t) => (
                          <option key={t} value={t}>{typeLabels[t]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 text-right font-mono text-muted-foreground">$0.00</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="xs" onClick={addAccount}>Save</Button>
                        <Button variant="ghost" size="xs" onClick={() => { setAddingRow(false); setActionError(null); }}>Cancel</Button>
                      </div>
                    </td>
                  </tr>
                )}
                {sorted.map((a) => (
                  <tr key={a.number} className="border-t border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2 font-mono text-muted-foreground">
                      {editingRow === a.number ? (
                        <input
                          type="number"
                          value={editValues.number}
                          onChange={(e) => setEditValues({ ...editValues, number: e.target.value })}
                          className="w-full border border-border rounded px-2 py-1 text-sm bg-background font-mono"
                        />
                      ) : (
                        a.number
                      )}
                    </td>
                    <td className="py-2">
                      {editingRow === a.number ? (
                        <input
                          type="text"
                          value={editValues.name}
                          onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                          className="w-full border border-border rounded px-2 py-1 text-sm bg-background"
                          autoFocus
                        />
                      ) : (
                        <span className="text-foreground">{a.name}</span>
                      )}
                    </td>
                    <td className="py-2">
                      {editingRow === a.number ? (
                        <select
                          value={editValues.type}
                          onChange={(e) => setEditValues({ ...editValues, type: e.target.value })}
                          className="w-full border border-border rounded px-2 py-1 text-sm bg-background"
                        >
                          {accountTypes.map((t) => (
                            <option key={t} value={t}>{typeLabels[t]}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge className={`${typeColors[a.type] ?? ""} hover:bg-opacity-100 text-xs`}>
                          {typeLabels[a.type] ?? a.type}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 text-right font-mono text-foreground">{fmt(a.balance)}</td>
                    {writable && (
                      <td className="py-2 text-right">
                        {editingRow === a.number ? (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="xs" onClick={() => saveEdit(a.number)}>Save</Button>
                            <Button variant="ghost" size="xs" onClick={cancelEdit}>Cancel</Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="xs" onClick={() => startEdit(a)}>Edit</Button>
                            <Button variant="ghost" size="xs" className="text-red-600 hover:text-red-700" onClick={() => deleteAccount(a.number, a.name)}>Delete</Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
    </RequireRole>
  );
}
