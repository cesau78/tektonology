"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApiFetch } from "@/lib/api";

interface AccountInfo {
  number: number;
  name: string;
  type: string;
}

interface LineItem {
  accountNumber: number | null;
  side: "debit" | "credit";
  amount: string;
  description: string;
}

const typeOrder = ["expense", "asset", "liability", "equity", "revenue", "cogs"];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TransactionForm({ accounts }: { accounts: AccountInfo[] }) {
  const router = useRouter();
  const apiFetch = useApiFetch();
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<LineItem[]>([
    { accountNumber: null, side: "debit", amount: "", description: "" },
    { accountNumber: null, side: "credit", amount: "", description: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const grouped = new Map<string, AccountInfo[]>();
  for (const a of accounts) {
    const list = grouped.get(a.type) ?? [];
    list.push(a);
    grouped.set(a.type, list);
  }

  const updateLine = (i: number, patch: Partial<LineItem>) => {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  };

  const addLine = () => {
    setLines((prev) => [...prev, { accountNumber: null, side: "debit", amount: "", description: "" }]);
  };

  const removeLine = (i: number) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, j) => j !== i));
  };

  const totalDebit = lines
    .filter((l) => l.side === "debit" && l.amount)
    .reduce((s, l) => s + parseFloat(l.amount || "0"), 0);
  const totalCredit = lines
    .filter((l) => l.side === "credit" && l.amount)
    .reduce((s, l) => s + parseFloat(l.amount || "0"), 0);

  const balanced = Math.abs(totalDebit - totalCredit) < 0.005;
  const allFilled = lines.every((l) => l.accountNumber != null && l.amount && parseFloat(l.amount) > 0);
  const canSave = balanced && allFilled && totalDebit > 0 && description.trim().length > 0;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    const entry = {
      date,
      description: description.trim(),
      lines: lines.map((l) => {
        const acct = accounts.find((a) => a.number === l.accountNumber);
        return {
          accountNumber: l.accountNumber,
          accountName: acct?.name ?? "",
          debit: l.side === "debit" ? parseFloat(parseFloat(l.amount).toFixed(2)) : null,
          credit: l.side === "credit" ? parseFloat(parseFloat(l.amount).toFixed(2)) : null,
          description: l.description,
        };
      }),
    };

    try {
      await apiFetch("/api/finance/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      setSaved(true);
      setTimeout(() => router.push("/finance/ledger"), 1000);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <Card className="shadow-sm border-emerald-300">
        <CardContent className="pt-6 text-center">
          <p className="text-emerald-700 font-medium">Transaction saved. Redirecting to ledger...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date & Description */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Transaction Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <label className="text-sm text-muted-foreground w-20">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="border border-border rounded-md px-3 py-1.5 text-sm bg-background text-foreground"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="text-sm text-muted-foreground w-20">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Bambu P1S Combo purchase"
                className="flex-1 border border-border rounded-md px-3 py-1.5 text-sm bg-background text-foreground"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Line Items</CardTitle>
            <Button variant="outline" size="sm" onClick={addLine}>
              + Add Line
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {lines.map((line, i) => (
              <div key={i} className="flex flex-wrap items-start gap-2 pb-3 border-b border-border/50 last:border-0 last:pb-0">
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
                        {(grouped.get(type) ?? []).map((a) => (
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
                    onClick={() => removeLine(i)}
                    disabled={lines.length <= 2}
                    className="text-muted-foreground hover:text-red-600"
                  >
                    x
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Balance + Save */}
      <Card className={`shadow-sm ${balanced && totalDebit > 0 ? "border-emerald-300" : totalDebit > 0 ? "border-red-300" : ""}`}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Debits: </span>
                <span className="font-mono font-semibold">${totalDebit.toFixed(2)}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Credits: </span>
                <span className="font-mono font-semibold">${totalCredit.toFixed(2)}</span>
              </div>
              {totalDebit > 0 && (
                <Badge className={balanced ? "bg-emerald-100 text-emerald-900 border-emerald-300" : "bg-red-100 text-red-900 border-red-300"}>
                  {balanced ? "Balanced" : `Off by $${Math.abs(totalDebit - totalCredit).toFixed(2)}`}
                </Badge>
              )}
            </div>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving ? "Saving..." : "Save Transaction"}
            </Button>
          </div>
          {saveError && (
            <p className="text-red-600 text-sm mt-2">{saveError}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
