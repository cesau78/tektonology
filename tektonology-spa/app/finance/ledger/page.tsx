"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  date: string;
  description: string;
  lines: JournalLine[];
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const typeColor: Record<number, string> = {};
// Color by account code range
function codeColor(code: number): string {
  if (code < 2000) return "text-emerald-700";  // Assets
  if (code < 3000) return "text-red-700";       // Liabilities
  if (code < 4000) return "text-blue-700";      // Equity
  if (code < 5000) return "text-emerald-700";   // Revenue
  return "text-orange-700";                      // Expense/COGS
}

export default function LedgerPage() {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { role } = useRole();
  const apiFetch = useApiFetch();

  useEffect(() => {
    apiFetch<JournalEntry[]>("/api/journal-entries")
      .then(setEntries)
      .catch((e) => setError(e.message));
  }, [apiFetch]);

  return (
    <RequireRole roles={["owner", "auditor"]}>
    <div>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>›</span>
        <Link href="/finance" className="hover:text-foreground transition-colors">Finance</Link>
        <span>›</span>
        <span className="text-foreground">General Ledger</span>
      </nav>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">General Ledger</h1>
          {entries && (
            <p className="text-muted-foreground text-sm">{entries.length} transactions.</p>
          )}
        </div>
        {canWrite(role) && (
          <Link href="/finance/new">
            <Button variant="outline" size="sm">+ New Transaction</Button>
          </Link>
        )}
      </div>

      {error && <ErrorState message={error} />}
      {!entries && !error && <LoadingState />}

      {entries && (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.transactionId} className="shadow-sm">
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Transaction #{entry.transactionId}</CardTitle>
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                </div>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                      <th className="text-left font-medium pb-1">Account</th>
                      <th className="text-right font-medium pb-1 w-24">Debit</th>
                      <th className="text-right font-medium pb-1 w-24">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.lines.map((line, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="py-1.5">
                          <span className={`font-mono text-xs ${codeColor(line.accountNumber)}`}>{line.accountNumber}</span>
                          <span className="ml-2 text-foreground">{line.accountName}</span>
                          {line.description && (
                            <span className="ml-2 text-xs text-muted-foreground">— {line.description}</span>
                          )}
                        </td>
                        <td className="text-right font-mono py-1.5">
                          {line.debit != null ? fmt(line.debit) : ""}
                        </td>
                        <td className="text-right font-mono py-1.5">
                          {line.credit != null ? fmt(line.credit) : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
    </RequireRole>
  );
}
